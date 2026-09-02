import { createFileRoute } from "@tanstack/react-router";
import { getPbAdmin } from "@/lib/pocketbase.server";
import { verifyWebhookSignature } from "@/lib/paystack.server";

const FIVE_YEARS_MS = 5 * 365 * 86400000;

export const Route = createFileRoute("/api/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-paystack-signature");

        if (!verifyWebhookSignature(rawBody, signature)) {
          // Never process an unverified body - this is the entire
          // difference between a trustworthy webhook and an endpoint
          // anyone could POST to and fake a payment.
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(rawBody);
        if (event.event !== "charge.success") {
          // Acknowledge everything else so Paystack stops retrying it,
          // we just don't act on it.
          return new Response("OK", { status: 200 });
        }

        const data = event.data;
        const reference: string = data.reference;
        const pbAdmin = await getPbAdmin();

        let payment: any;
        try {
          payment = await pbAdmin
            .collection("agency_payments")
            .getFirstListItem(pbAdmin.filter("paystack_reference = {:ref}", { ref: reference }));
        } catch {
          // A charge.success for a reference we never created - log and
          // acknowledge, don't 500 (Paystack would just keep retrying
          // something that will never resolve).
          console.error(`[paystack webhook] Unknown reference: ${reference}`);
          return new Response("OK", { status: 200 });
        }

        // Idempotency: Paystack retries webhooks on any non-2xx response,
        // and can send the same event more than once even on success.
        // Without this check, retried delivery of one real payment would
        // grant add-on credits twice.
        if (payment.status === "success") {
          return new Response("OK", { status: 200 });
        }

        const authorizationCode: string | undefined = data.authorization?.authorization_code;
        const isReusable: boolean = data.authorization?.reusable === true;

        await pbAdmin.collection("agency_payments").update(payment.id, {
          status: "success",
          completed_at: new Date().toISOString(),
          paystack_authorization_code: authorizationCode ?? null,
        });

        if (isReusable && authorizationCode) {
          await pbAdmin.collection("agency_clients").update(payment.agency_client_id, {
            paystack_authorization_code: authorizationCode,
          });
        }

        if (payment.purpose === "addon_purchase" && payment.addon_usage_type && payment.addon_quantity) {
          await pbAdmin.collection("agency_usage_credits").create({
            agency_client_service_id: payment.agency_client_service_id,
            usage_type: payment.addon_usage_type,
            source: "purchased",
            amount: payment.addon_quantity,
            remaining: payment.addon_quantity,
            granted_at: new Date().toISOString(),
            // Placeholder expiry - see ARCHITECTURE.md §13. Not a real
            // "never expires" decision, just safely far enough out.
            expires_at: new Date(Date.now() + FIVE_YEARS_MS).toISOString(),
          });
        }

        // monthly_renewal and setup_fee payments are recorded above but
        // deliberately don't touch current_period_end or
        // onboarding_status here - that's billing-cycle logic tied to
        // the pause/cancel scheduled job, explicitly held back per
        // instruction until the cancellation policy exists.

        return new Response("OK", { status: 200 });
      },
    },
  },
});
