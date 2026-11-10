# Unofficial Colanode feature fork

This is an unofficial fork of [Colanode](https://github.com/colanode/colanode).
It is based on public commit `d649523637f0f059c936418488165d4a689da27c`
(the v0.4.7 release and upstream main at the time this candidate was prepared).
The upstream LICENSE and existing attribution are retained. No official
endorsement is implied.

## Changes

- Derive record activity from the later of node-attribute and body-document
  metadata, including query filtering/sorting and reactive document events.
  Creation metadata is unchanged; this is a read projection, not a timestamp write.
  Existing locale-dependent date formatting is retained.
- Add an **Embed** document command for Google Drive file previews and direct
  HTTPS image URLs. Store an ordinary linked paragraph plus optional display
  metadata. Older editor schemas retain the source link. An Open source link is
  always available; managed attachment upload and arbitrary HTML/iframe embedding
  are not added. Source permissions still apply. There is no authenticated proxy,
  new OAuth setup, signing/refresh of temporary URLs or sharing-permission change.

## Reproduce checks

Use a supported Node 22 environment and the unchanged upstream lockfile:

```sh
npm ci
npm run test -w @colanode/client -- --run test/record-activity.test.ts
npm run test -w @colanode/web -- --run test/editor/external-reference.test.tsx
npm run build -w @colanode/core
npm run build -w @colanode/crdt
npm run build -w @colanode/client
npm run build -w @colanode/ui
npm run build -w @colanode/web
```

The tests use synthetic records and example URLs. They cover activity precedence,
creation/source immutability, SQL filtering/sorting, URL/provider boundaries,
Yjs roundtrip and old-editor link retention, and direct-image error fallback.
Real account permissions and provider playback require a separate browser check.
Iframe load alone is not evidence of media access or playback.

No dependencies or lockfiles are added or changed. The candidate does not alter
server behavior, deployment configuration, accounts, workspace content or storage
backends. The feature patches do not require a database schema migration.
