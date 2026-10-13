# Sync de biblioteca na nuvem (multiutilizador)

Atualizado em 2026-10-13.

## Promessa

Cada conta autenticada (Stripe `customerId`) tem a sua biblioteca na nuvem. Login / logout / botão **Sync na nuvem** mantêm projetos entre browsers do mesmo utilizador. Contas diferentes nunca partilham o mesmo slot.

## API

- `GET /api/library-sync` — meta
- `GET /api/library-sync?full=1` — manifesto
- `GET /api/library-sync?asset={id}` — asset
- `POST /api/library-sync` — `{ action: 'status' | 'putAsset' | 'push' }`

Auth: `requireActiveSubscription` (cookie `vc_access`).

## Storage

- Blob: `library-sync/{customerId}/manifest.json` e `.../assets/{assetId}`
- Redis: meta `vc:library-sync:meta:{customerId}`
- Memória só em test/dev

## Cliente

`src/utils/library-sync.js` — pack (compacta imagens), upload de assets, push/pull, `reconcileLibraryCloud` no boot (`useAccess`).

## Fora de escopo (v1)

- Colaboração em tempo real
- Sync de chaves BYOK
- Merge slide-a-slide (LWW por revision)
