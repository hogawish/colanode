<!-- Modified by hogawish: adopt the Tsuzunowa product name; retain fork history and license. -->

# Tsuzunowa — Colanode origins and changes

Tsuzunowa（つづのわ）is an independently maintained, unofficial fork of
[Colanode](https://github.com/colanode/colanode). Its name combines 綴る
(tsuzuru, to write or bind together) and 輪 (wa, a circle). See the
[README](README.md) for the current product introduction and preview setup.
It is based on public commit `d649523637f0f059c936418488165d4a689da27c`
(the v0.4.7 release and upstream main at the time this candidate was prepared).
The upstream LICENSE and existing attribution are retained. No official
endorsement is implied.

Copyright 2026 hogawish, for this fork's modifications. These modifications are
provided under the Apache License, Version 2.0; see [LICENSE](LICENSE). Existing
upstream copyright and attribution notices remain in effect.

Report fork-specific problems to this repository's Issues. These changes are not
included in the official app, cloud service, or released desktop binaries.
Follow the [fork roadmap](https://github.com/hogawish/tsuzunowa/issues/1) for
page-sharing development and discussion. Fork preview tags identify source
snapshots for local builds.

## Source preview `fork-0.2.0-alpha.1`

This preview adds sharing an original page with view or edit access, invitations,
inherited access to descendants, and a Shared with me sidebar. Page access can be
managed from the page or the Workspace member list. Space references open the
same original page from another Space.

Spaces support optional tags, search, member/tag filters, personal pins and Hide,
and saved filter views. Each member/tag filter can match any or all selected
values. Advanced filters combine nested AND/OR groups. Saved views can be copied
as links containing the current conditions and sort order.

Notion migration is a preview feature: export a page hierarchy and databases with
original body images, video, audio, PDFs and other attachments in ZIP, or import
Notion HTML/Markdown and CSV exports as fresh Colanode pages. Notion export ZIP
envelopes and distinct ZIP parts are supported. A separate direct Notion copy
maps media and owned inline databases to native blocks with a user-supplied
connection. This is migration, not synchronization or full-fidelity interchange.
See [export/import scope](docs/page-export.md) for limits and acceptance evidence.

See [sharing and saved views](docs/sharing-and-space-views.md) for permission
semantics and [the release notes](docs/releases/fork-0.2.0-alpha.1.md) for scope,
upgrade, backup, rollback, and validation instructions.

### Included from `fork-0.1.0-alpha.1`

- Copy a link to a block from its handle and jump back to it. The handle also
  offers formatting, background color, and block type conversion.
- Select table rows for bulk actions. Use manual sort to save a custom order
  per view and drag selected rows together.
- Drag board cards within and between columns and manage grouping options.
- Reorder sidebar items and use the hide and archive controls.

The preview targets the browser and a local self-hosted server.

### Try the preview locally

With Docker and Docker Compose available, clone the tag and start the preview:

```sh
git clone --branch fork-0.2.0-alpha.1 https://github.com/hogawish/tsuzunowa.git
cd tsuzunowa
docker compose -p colanode-fork-preview -f hosting/docker/fork-preview.yaml up -d --build
```

Open [the local Web app](http://localhost:4000). In **Add a server**, enter
`http://localhost:3000/config`, create a local account, and create a workspace.
The preview uses loopback ports 3000 and 4000 and its own Docker volumes.
To stop it and keep the data, run:

```sh
docker compose -p colanode-fork-preview -f hosting/docker/fork-preview.yaml down
```

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
The live activity projection retains the latest observed body timestamp until
reload; body-document deletion or a timestamp rollback is not recomputed live.

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

Use Node.js 22.13 or later in the supported Node 22 line and this fork's committed
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
insertion after an intervening edit or cancellation. Paragraph splits at the end
and middle of a reference preserve one preview. JSDOM does not verify native
browser layout or input-method behavior.
Real account permissions and provider playback require a separate browser check.
Iframe load alone is not evidence of media access or playback.

The first preview's activity and embed patches require no database migration.
This sharing release adds migrations 00033 and 00034 for page grants and
invitations. Deploy the matching Web and server source together. The source-built
Compose example keeps Postgres, Valkey, and uploaded files in named volumes.
