export type AddonPack = { quantity: number; priceRand: number; label: string };

export type UsageType = "voice_minute" | "email" | "sms" | "whatsapp_conversation" | "ai_operation";

export const USAGE_LABELS: Record<UsageType, string> = {
  voice_minute: "Voice minutes",
  email: "Emails",
  sms: "SMS",
  whatsapp_conversation: "WhatsApp conversations",
  ai_operation: "AI operations",
};

// Email packs: exact numbers given in AGENCY-SERVICES-DOCUMENTATION.md §9.
// All other usage types: proposed packs at the flat per-unit customer
// rate (no pack discount, matching email's own flat R0.025/email with
// no volume break) - not explicitly specified, adjust freely.
export const ADDON_PACKS: Record<UsageType, AddonPack[]> = {
  email: [
    { quantity: 2000, priceRand: 50, label: "2,000 emails" },
    { quantity: 4000, priceRand: 100, label: "4,000 emails" },
    { quantity: 8000, priceRand: 200, label: "8,000 emails" },
    { quantity: 20000, priceRand: 500, label: "20,000 emails" },
    { quantity: 40000, priceRand: 1000, label: "40,000 emails" },
  ],
  voice_minute: [
    { quantity: 20, priceRand: 100, label: "20 minutes" },
    { quantity: 60, priceRand: 300, label: "60 minutes" },
    { quantity: 150, priceRand: 750, label: "150 minutes" },
  ],
  sms: [
    { quantity: 50, priceRand: 45, label: "50 SMS" },
    { quantity: 150, priceRand: 135, label: "150 SMS" },
    { quantity: 500, priceRand: 450, label: "500 SMS" },
  ],
  whatsapp_conversation: [
    { quantity: 100, priceRand: 50, label: "100 conversations" },
    { quantity: 300, priceRand: 150, label: "300 conversations" },
    { quantity: 1000, priceRand: 500, label: "1,000 conversations" },
  ],
  ai_operation: [
    { quantity: 500, priceRand: 50, label: "500 operations" },
    { quantity: 2000, priceRand: 200, label: "2,000 operations" },
    { quantity: 5000, priceRand: 500, label: "5,000 operations" },
  ],
};
