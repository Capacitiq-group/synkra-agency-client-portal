import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPbAdmin } from "@/lib/pocketbase.server";
import { initializeTransaction } from "@/lib/paystack.server";

const InitializeInput = z.object({
  agency_client_service_id: z.string().min(1).optional(),
  purpose: z.enum(["setup_fee", "monthly_renewal", "addon_purchase"]),
  addon_usage_type: z.enum(["voice_minute", "email", "sms", "whatsapp_conversation", "ai_operation"]).optional(),
  addon_quantity: z.number().int().positive().optional(),
  amount_rand: z.number().positive(),
});

export const Route = createFileRoute("/api/paystack/initialize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);

        const body = await request.json().catch(() => null);
        const parsed = InitializeInput.safeParse(body);
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        const pbAdmin = await getPbAdmin();

        // Verify the caller's own session token against the same
        // instance, same pattern as web-main's admin.upload.ts - proves
        // this is a real logged-in client, not a public endpoint anyone
        // can hit to generate arbitrary Paystack transactions.
        const PocketBase = (await import("pocketbase")).default;
        const url = process.env["POCKETBASE_URL"];
        if (!url) return new Response("Server not configured", { status: 500 });
        const verifier = new PocketBase(url.replace(/\/+$/, ""));
        verifier.autoCancellation(false);
        verifier.authStore.save(token, null);
        let userRecord;
        try {
          const result = await verifier.collection("agency_client_users").authRefresh();
          userRecord = result.record;
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const agencyClientId = userRecord["agency_client_id"] as string;
        const client = await pbAdmin.collection("agency_clients").getOne(agencyClientId);

        const reference = `synkra_${parsed.data.purpose}_${crypto.randomUUID()}`;

        const payment = await pbAdmin.collection("agency_payments").create({
          agency_client_id: agencyClientId,
          agency_client_service_id: parsed.data.agency_client_service_id ?? null,
          purpose: parsed.data.purpose,
          addon_usage_type: parsed.data.addon_usage_type ?? null,
          addon_quantity: parsed.data.addon_quantity ?? null,
          amount_rand: parsed.data.amount_rand,
          paystack_reference: reference,
          status: "pending",
        });

        const appUrl = process.env["APP_URL"];
        if (!appUrl) return new Response("Server not configured (APP_URL)", { status: 500 });

        try {
          const { authorizationUrl } = await initializeTransaction({
            email: client["contact_email"] as string,
            amountRand: parsed.data.amount_rand,
            reference,
            callbackUrl: `${appUrl.replace(/\/+$/, "")}/billing?reference=${reference}`,
            metadata: {
              agency_payment_id: payment.id,
              purpose: parsed.data.purpose,
            },
          });
          return Response.json({ checkoutUrl: authorizationUrl, reference });
        } catch (err: any) {
          await pbAdmin.collection("agency_payments").update(payment.id, { status: "failed" });
          return new Response(err?.message ?? "Could not start checkout", { status: 502 });
        }
      },
    },
  },
});
