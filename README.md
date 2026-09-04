# Synkra Agency Client Portal

Client-facing portal for Synkra Agency clients: invite acceptance,
dashboard, per-service intake forms, usage display, billing, and
add-on purchases via Paystack.

Built with TanStack Start + PocketBase, same stack as `synkra--web`
and `synkra-client-hub`.

> **Architecture:** the canonical description of Synkra's PocketBase instances,
> which repo uses which one, and the identity model lives in one place:
> [`SYNKRA-ARCHITECTURE.md` in `synkra-os`](https://github.com/Capacitiq-group/synkra-os/blob/main/SYNKRA-ARCHITECTURE.md).
> Do not restate it here — update it there.

## Getting started

```
npm install
cp .env.example .env
npm run dev
```

Requires access to the shared PocketBase instance (see the canonical
architecture doc linked above) and the env vars in `.env.example`.

## Known open items

See the canonical architecture doc's "Known gaps" section for what's
explicitly deferred (pause/cancel job, renewal job, usage-credit
consumption writer, Zoho invoice display).
