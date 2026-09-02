// Server-side only. All amounts in Rand in/out of this module's public
// functions - conversion to kobo/cents (Paystack's smallest-unit
// requirement) happens at the boundary, not left to callers to remember.
import crypto from "node:crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY environment variable.");
  return key;
}

async function paystackFetch(path: string, init: RequestInit) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const data = await res.json();
  if (!res.ok || data.status === false) {
    throw new Error(data.message ?? `Paystack API error (${res.status})`);
  }
  return data.data;
}

export type InitializeTransactionInput = {
  email: string;
  amountRand: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
};

/** Returns the Paystack-hosted checkout URL to redirect the client to. */
export async function initializeTransaction(input: InitializeTransactionInput): Promise<{ authorizationUrl: string; accessCode: string }> {
  const data = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountRand * 100), // Rand -> cents
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  return { authorizationUrl: data.authorization_url, accessCode: data.access_code };
}

/**
 * Charges a previously-stored recurring authorization directly, no
 * checkout redirect - used by the (not-yet-built) renewal job. Built now
 * so that piece has something real to call once it exists, rather than
 * inventing its own Paystack wrapper later.
 */
export async function chargeAuthorization(input: {
  authorizationCode: string;
  email: string;
  amountRand: number;
  reference: string;
  metadata: Record<string, unknown>;
}): Promise<{ status: string; reference: string }> {
  const data = await paystackFetch("/transaction/charge_authorization", {
    method: "POST",
    body: JSON.stringify({
      authorization_code: input.authorizationCode,
      email: input.email,
      amount: Math.round(input.amountRand * 100),
      reference: input.reference,
      metadata: input.metadata,
    }),
  });
  return { status: data.status, reference: data.reference };
}

/**
 * Verifies a webhook actually came from Paystack - HMAC-SHA512 of the
 * raw request body using the secret key, compared against the
 * x-paystack-signature header. This is what makes the webhook a
 * trustworthy source of truth rather than something anyone could POST
 * to fake a successful payment.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const hash = crypto.createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  return hash === signatureHeader;
}
