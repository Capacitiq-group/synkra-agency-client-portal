# Synkra Agency Client Portal

Client-facing portal for Synkra Agency clients: invite acceptance,
dashboard, per-service intake forms, usage display, billing, and
add-on purchases via Paystack.

Built with TanStack Start + PocketBase, same stack as
`synkra--web-main` and `synkra-client-hub`. See `ARCHITECTURE.md` for
the full data model this app (and the not-yet-built Admin Panel and AI
Implementation Agent) share.

## Getting started

```
npm install
cp .env.example .env
npm run dev
```

Requires a running Agency PocketBase instance with the collections
described in `ARCHITECTURE.md` §3, and the env vars in §7.

## Known open items

See `ARCHITECTURE.md` §6 for what's explicitly deferred (pause/cancel
job, renewal job, usage-credit consumption writer, Zoho invoice
display) and §2 for the one unresolved architectural decision
(`agency_quote_requests`' PocketBase instance).
