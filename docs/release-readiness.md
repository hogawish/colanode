<!-- Modified by hogawish: update the published repository link after the Tsuzunowa rename. -->

# Notion migration and sharing: release readiness

Proposed release: **fork-0.2.0-alpha.1**, an alpha source preview for the Web app
and self-hosted API. Updated 2026-11-24. **Publication approved.** Isolated
installation, upgrade/restore, and normal-HTTP import/export acceptance pass.
The [GitHub prerelease](https://github.com/hogawish/tsuzunowa/releases/tag/fork-0.2.0-alpha.1)
records publication status and the tagged source.

## Scope

The preview includes page sharing/invitations and Space saved views/filters,
plus Notion ZIP import/export of page trees, database CSVs, row bodies and
original image/video/audio/PDF/file attachments. Direct Notion copy adds native
media and owned inline databases using a request-only connection token.
See [release notes](releases/fork-0.2.0-alpha.1.md),
[sharing semantics](sharing-and-space-views.md), and [migration scope](page-export.md).

## Completed candidate checks

- Web: **281 passing tests in 46 files**, including two optional real Notion
  export fixtures; related record-activity checks: **2 passing tests**.
- Shared package TypeScript checks, server compile, changed TypeScript ESLint,
  and Web/API production builds pass. Local checks used Windows Node 24; the
  public Dockerfiles use Node 22 and are checked independently.
- Actual Notion export fixtures from the official Obsidian Importer repository
  are pinned to commit 4020f2c1b4eaac7e3dfd4a1632fa4e919e29f916 and verified by
  Git blob SHA. One exercises 279 pages and 269 records/database parsing; another
  exercises five HTML pages and five local images. Missing/ambiguous row bodies
  produce warnings and are preserved separately. These archives are not
  redistributed. The checks found and fixed outer ZIP envelope handling and
  recursion around inline-wrapped media links. Native write/readback acceptance
  also found self-page hyperlinks becoming cyclic page nodes; self/backlinks and
  repeated references now stay ordinary links, and only owned children get native
  placement. Markdown import uses its own parser to avoid the editor's global
  task-list extension changing import token types.
- On a separate candidate Web/API served over ordinary HTTP, real Notion HTML
  export imports five pages and five byte-identical JPEG attachments. A real
  Markdown/CSV export imports 550 nodes including its wrapper, 269 records and
  one database. Authenticated server readback verifies 548 document bodies and
  every CSV property value. Ambiguous row bodies stay separate with warnings.
- On that same isolated candidate, UI Import → ZIP export → reimport preserves
  five original file types, names, subtypes, body order and exact bytes, including
  a valid MP4 padded with an ISO free box to **21 MiB**. No human workspace is used.
- Read-only hierarchy export respects the existing device request quota.
  Explicit HTTP 429 responses wait for Retry-After, or 60 seconds without it,
  and retry up to three times per read. Other failures and writes are not retried.
  The actual settings-menu/worker export of the imported large fixture finishes
  in about six minutes: 549 HTML pages plus a CSV database with all 269 row values
  matching. It uses the unchanged normal API quota and has no browser exceptions.
- The user confirmed a video exported in ZIP successfully imported into Notion.
  Size and codec were not recorded; this does not establish live multipart or
  the application's dedicated-token transfer route.
- Existing live 18400 synthetic five-type Import → ZIP export → reimport checks
  preserve original bytes, names, subtypes and body order; video/audio metadata
  and image loading pass. These checks precede dependency remediation.
- Ordered multipart upload above 20 MiB is contract-tested. Timeout/503 during
  a part retain the partial destination, never complete/insert a partial file,
  and do not automatically retry ambiguous writes. Transport errors now explain
  connection/permission checks and checking current state before retrying.
- A pattern scan of changed tracked files found no private keys, common
  token forms or machine-specific paths; no changed binary files were present.
  This is a limited pattern scan, not a guarantee of absence of every secret.
  Upstream LICENSE remains unchanged; fork attribution is retained.

## Dependency remediation

The API production-workspace audit changed from **27 affected package entries**
(1 critical, 14 high, 10 moderate, 2 low) to **0** on 2026-11-24. This is an npm
advisory result for the selected production dependency graph, not proof that the
application or operating-system images have no vulnerabilities.

Patched libraries include Handlebars 4.7.10, sharp 0.35.5, Nodemailer 10.6.1,
Fastify 5.12.8 and Zod 4.6.7. Tiptap dependencies are aligned to 3.35.x. A scoped
teeny-request override uses uuid 11.1.1; its v4 multipart-boundary call is covered
by a real local HTTP save using the Google Cloud SDK. No cloud account is used.
PNG-to-JPEG resize and authenticated local SMTP verification/delivery with
escaped Handlebars content also pass. These are compatibility checks, not full
cloud-provider or production SMTP acceptance.

Developer icon/emoji/seed tooling is dev-only and removed by production pruning.
Docker contexts exclude local environment secrets, Git data, node_modules and
build outputs. Web runtime follows stable Alpine Nginx. Base-image tags remain
mutable; source tagging alone does not pin their digests.

The selected Web dependency audit reports one **moderate minimatch advisory in
build tooling** through vite-plugin-pwa/workbox/glob. The public Web runtime is
static Nginx, not a shipped Node install; this tooling is not runtime code. The
whole monorepo also contains mobile/development graphs outside this preview. Additional compatible lock-only patches removed the remaining critical entries there; 15 affected entries remain (2 high in mobile image-size/PostCSS paths, 13 moderate). These are not shipped in the Web/API runtime, and mobile/desktop are not release targets. The selected Web/API production dependency trees are byte-for-byte equivalent as version graphs before/after that extra lock update.
The actual production API image also reports zero npm audit findings. Both
selected production version graphs were compared independently with the earlier
audited candidate and are unchanged by the extra lockfile patches.

Sources: [Handlebars advisory](https://github.com/advisories/GHSA-p8wg-vrv2-v86f),
[Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

## Installation, upgrade and restore

An independent deployment owner built the tracked-source public Dockerfiles and
started fresh API/Web images: schema34, config and deep URLs return successfully;
the image's sharp PNG-to-JPEG conversion passes. The isolated API suite passes
**23 tests in 11 files**, covering access, revocation, invitations and referenced
files. Web runtime contains static assets rather than a Node dependency install.

The actual previous published source, fork-0.1.0-alpha.1 / afeedaec, was built and
started at schema32. Synthetic pages, child hierarchy, an inline database/record
body, and a 39-byte HTTP TUS upload were created there. All old rows across ten
tables and the original attachment hash survive upgrade to schema34. Restoring
the matched schema32 database/upload pair into a separate empty database and
upgrading, and restoring the schema34 pair, also preserve those rows and bytes.

Only task-owned isolated resources were used. The existing 18400 trial services,
volumes, access rules and CORS remain unchanged.

## Publication boundary

The Human approved source publication, the tag and GitHub alpha prerelease on
2026-11-24 after reviewing these results and limits. The release covers Web/API
source for local builds. Native installers, published container images and public
hosted deployment are outside this release.

A candidate delivered by synthetic CDP response interception hit Chrome's local
network address-space checks; it is not accepted as normal HTTP browser evidence.
No live 18400 CORS or service configuration was changed to work around that test.

## Explicit preview limits

This is migration, not synchronization or complete Notion interchange. CSV
properties become text; views, relations, formulas, permissions and history are
not reconstructed. Standard Notion ZIP import may place media as links. Direct
token transfer and live multipart into Notion remain experimental until tested
with a dedicated user connection; unit payload tests and native connector-file
checks are not that end-to-end evidence. Desktop/mobile and real provider account
behavior remain outside the Web source preview.
