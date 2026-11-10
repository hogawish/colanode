# Unofficial Colanode feature fork

This is an unofficial fork of [Colanode](https://github.com/colanode/colanode).
It is based on public commit `d649523637f0f059c936418488165d4a689da27c`
(the v0.4.7 release and upstream main at the time this candidate was prepared).
The upstream LICENSE and existing attribution are retained. No official
endorsement is implied.

Copyright 2026 hogawish, for this fork's modifications. These modifications are
provided under the Apache License, Version 2.0; see [LICENSE](LICENSE). Existing
upstream copyright and attribution notices remain in effect.

## Changes

- Derive record activity from the later of node-attribute and body-document
  metadata, including query filtering/sorting and reactive document events.
  Creation metadata is unchanged; this is a read projection, not a timestamp write.
  Existing locale-dependent date formatting is retained.
- Add an **Embed** document command for Google Drive file previews and HTTPS
  URLs to load as images. The remote content type is not checked before insertion;
  a URL that does not return a displayable image falls back to its source link.
  Store an ordinary linked paragraph plus optional display
  metadata. Older editor schemas retain the source link. An Open source link is
  always available; managed attachment upload and arbitrary HTML/iframe embedding
  are not added. Source permissions still apply. There is no authenticated proxy,
  new OAuth setup, signing/refresh of temporary URLs or sharing-permission change.

## Activity semantics

For records, an absent update timestamp/user falls back to the creation
timestamp/creator. Consequently, `updated_at` and `updated_by` no longer count as
empty on a never-edited record: `is_empty`/`is_not_empty` filters change accordingly,
and an update-user filter can match the creator. Initialization of a body document
can also supply its later creation timestamp. Non-record metadata is unchanged.
The projection assumes the application's canonical UTC ISO timestamp strings;
performance at very large workspace sizes has not been benchmarked here.

## External requests and shared references

Opening a document can automatically load a visible embed in each reader's browser
(with lazy loading). The browser connects directly to Google Drive or the URL's
host. That host receives ordinary request information, including the reader's IP
address, user agent, and request time. `no-referrer` hides the referring page, not
the request itself. No new managed attachment or application-level media cache is
created; ordinary browser caching and provider access/cookie policies still apply.

The original URL, including any Drive `resourcekey`, is shared with readers of
the document just like an ordinary source link. Do not embed URLs containing
secrets or private access tokens. Rejection of common credential/signature query
parameters is best-effort accidental-paste protection, not a guarantee that every
credential-bearing URL will be recognized. Signed-URL issuance/renewal is not
implemented.

Verification covers the Web build and editor regressions below. Native desktop,
mobile, Japanese IME, and real provider account/playback behavior have not been
validated for this public candidate.

## Reproduce checks

Use Node.js 22.13 or later in the supported Node 22 line and the unchanged upstream
lockfile. The regression tests use `node:sqlite`, available without its experimental
flag starting with Node.js 22.13.

```sh
npm ci
npm run test -w @colanode/client -- --run test/record-activity.test.ts
npm run test -w @colanode/web -- --run test/editor/external-reference.test.tsx test/editor/external-reference-editor.test.tsx
npm run build -w @colanode/core
npm run build -w @colanode/crdt
npm run build -w @colanode/client
npm run build -w @colanode/ui
npm run build -w @colanode/web
```

The tests use synthetic records and example URLs. They cover activity precedence,
creation/source immutability, SQL filtering/sorting, URL/provider boundaries,
Yjs roundtrip and old-editor link retention, and direct-image error fallback.
Real Tiptap editor tests in JSDOM also check native paragraph/task/list/table DOM,
widget update/removal/destruction, retained surrounding text and links, and dialog
insertion after an intervening edit or cancellation. JSDOM does not verify native
browser layout or input-method behavior.
Real account permissions and provider playback require a separate browser check.
Iframe load alone is not evidence of media access or playback.

No dependencies or lockfiles are added or changed. The candidate does not alter
server behavior, deployment configuration, accounts, workspace content or storage
backends. The feature patches do not require a database schema migration.
