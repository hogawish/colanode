<!-- Modified by hogawish: update repository links and clone directory after the Tsuzunowa rename. -->

# fork-0.2.0-alpha.1

Alpha source preview for the browser and a self-hosted Colanode server, based on
upstream v0.4.7. The previous source snapshot is fork-0.1.0-alpha.1.

Release date: **2026-11-24**. See the
[GitHub prerelease](https://github.com/hogawish/tsuzunowa/releases/tag/fork-0.2.0-alpha.1)
and [validation record](../release-readiness.md).

## Changes

- Share an original page with Can view or Can edit, invite a new guest by email
  address using a copyable invitation link, and manage direct grants per user.
- Browse shared child pages and owned databases, preview attached images, follow
  stable block links, and edit the original shared body inline.
- Reference a source page from another Space while retaining source access checks.
- Search Spaces, assign tags, filter by member and tag, pin and hide Spaces for
  yourself, and sort by name or recently opened.
- Save named Space views and distribute a snapshot link. Quick filters support
  any/all matching. Advanced filters support nested AND/OR groups.

[Usage and access semantics](../sharing-and-space-views.md) describe inherited
permissions, shared editor limitations, file visibility, and view links.

- Preserve deployed startup recovery, missing-image cache recovery, cold database
  loads, and stable shared-editor toggles and block IDs.

- Export the currently displayed page, record, database view, or shared page to
  standalone HTML, or preview it for browser Print / Save as PDF. Child pages stay
  links and database exports contain displayed rows.
- Keep block handles and formatting/link popovers inside record modals so modal
  pointer/focus containment does not block actions.

- Migrate page trees, database CSVs and row bodies with original images, videos,
  audio, PDFs and file attachments using Notion ZIP export/import. Import always
  creates a fresh subtree and does not overwrite the destination page.
- Read Notion's outer ZIP envelopes and distinct ZIP parts within shared size,
  entry-count and nesting limits. Inline-wrapped file links no longer recurse.
- Preserve self/backlinks as links, avoid cyclic page nodes, and isolate the
  Markdown parser from editor extensions. Large hierarchy exports wait for the
  existing request quota and resume the authorized read without retrying writes.
- Copy directly to Notion using native media blocks and owned inline databases;
  uploads above 20 MiB use multipart. Connection tokens are request-only.
- Update vulnerable Web/API dependencies, align Tiptap packages, remove developer
  tooling from API production dependencies, and exclude local secrets/build
  output from Docker contexts. The Web runtime follows stable Alpine Nginx.

[Export scope and usage](../page-export.md) describe the snapshot limitations.

## Notion migration preview

| Direction                                 | Included                                                                                     | Limitations                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Colanode → Notion ZIP                     | Page trees, database CSVs, linked row bodies, original image/video/audio/PDF/file bytes      | Notion controls native media/inline placement. CSV row-body attachment and property types may need adjustment. |
| Notion HTML/Markdown & CSV ZIP → Colanode | Fresh native pages, hierarchy, basic formatting, row bodies and referenced local attachments | Missing or ambiguous row bodies are retained separately with warnings. External files are not fetched.         |
| Direct copy to Notion (experimental)      | Native media and owned inline databases using a user connection; multipart above 20 MiB      | Live application-token and large multipart acceptance are not complete.                                        |

Import creates a new subtree after a preview; it does not overwrite the original
destination page. This is a migration tool, not a synchronization service or a
permission/history backup. Inspect the destination before removing source data.

## Local installation

Build from the source tag:

```sh
git clone --branch fork-0.2.0-alpha.1 https://github.com/hogawish/tsuzunowa.git
cd tsuzunowa
docker compose -p colanode-fork-preview -f hosting/docker/fork-preview.yaml up -d --build
```

Open http://localhost:4000 and enter http://localhost:3000/config in **Add a
server**. The Compose example binds both services to loopback. Its database and
uploads stay in named volumes. Its fixed local-preview database password is for
that local setup.

## Upgrade from fork-0.1.0-alpha.1

Use the same Docker Compose project name and volume names used for the first
preview. The example below assumes that project name is colanode-fork-preview.
Run it from the existing repository checkout.

Back up the database and uploaded files together while writes are stopped.
Back up your custom server configuration and record the current source tag and
Compose project name as well. These commands stop application writes and archive
the existing database and upload volume before rebuilding.

```sh
mkdir -p backup-before-sharing
docker compose -p colanode-fork-preview -f hosting/docker/fork-preview.yaml stop server
docker compose -p colanode-fork-preview -f hosting/docker/fork-preview.yaml exec -T postgres pg_dump -U colanode -d colanode -Fc -f /tmp/before-sharing.dump
docker compose -p colanode-fork-preview -f hosting/docker/fork-preview.yaml cp postgres:/tmp/before-sharing.dump ./backup-before-sharing/database.dump
docker compose -p colanode-fork-preview -f hosting/docker/fork-preview.yaml run --rm --no-deps -T -v ./backup-before-sharing:/backup --entrypoint sh server -c 'tar -C /app/data -czf /backup/uploads.tar.gz .'
git fetch origin --tags
git switch --detach fork-0.2.0-alpha.1
docker compose -p colanode-fork-preview -f hosting/docker/fork-preview.yaml up -d --build
```

The server applies migrations 00033 and 00034 at startup. They add page-share
and invitation tables, including the viewer/editor grant role. Existing records
and file paths remain in their current tables and upload volume. Deploy the
matching Web and API together, reload the browser, and verify an existing page,
an existing attachment, and a share to a second account.

For a customized installation, use its configured storage directory or bucket
for the upload backup. The source-built Compose example defaults to /app/data.
The source tag pins the application code. Its Node, Postgres, Redis-compatible
service, and Nginx base images remain tag-based.

## Rollback

Keep a copy of the current database and uploads before rolling back so work
created after the upgrade can be recovered. Stop the server, return to the
previous source tag, and restore the matched pre-upgrade database/upload backup.
Start the previous Web and server and check an existing page and attachment.

Use `pg_restore --clean --if-exists --no-owner` against the selected local-preview
database while the server is stopped. Restore uploads into the configured upload
volume. Check that the Compose project is the intended one before restoring.
Page grants and invitations created by this candidate depend on its new tables.
Do not point the old server at the migrated database as the rollback method.

## Validation

Use the Node 22 line supported by the first preview, with Node.js 22.13 or later,
and Docker for the API integration tests.

```sh
npm ci
npx tsc -b packages/crdt packages/ui
npm run compile -w @colanode/server
npm run test -w @colanode/web -- --run
npm run test -w @colanode/client -- --run test/record-activity.test.ts
npm run test -w @colanode/server
npm run build -w @colanode/web
npm run build -w @colanode/server
```

The API suite uses temporary PostgreSQL and Redis containers and synthetic
accounts. The page-sharing cases exercise viewer/editor behavior, inherited child
access, removal of access, source checks for linked databases, referenced-file
downloads, invitation identity checks and one-use tokens, and stale-save rejection.
Browser component tests cover filtering, saved-view links, any/all compatibility,
grouped filters, and personal Hide across users.

Optional real Notion export tests use `Notion.Test.Export.zip` and
`notion-testspace.zip` from the pinned public fixture source linked in
[export/import scope](../page-export.md). Place them in a writable directory and
set `NOTION_REAL_FIXTURE_DIR` to that absolute directory before running the Web
suite. The tests write result summaries beside the fixtures. They do not download
archives automatically; these four checks are skipped without the variable.

## Known limits

- This is an alpha source release. The preview targets the Web app and locally
  built API. Native desktop/mobile distributions are not built by this fork.
- Invitations return links for manual delivery. Automatic invitation mail is
  not part of this sharing flow.
- Shared page edits support the body. Shared child-page creation, shared database
  record editing, and file/reference creation require existing Space access.
- Removing a direct child grant leaves access inherited from a shared parent or
  from the original Space. Previously downloaded copies cannot be recalled.
- User view/pin/Hide preferences are local to the browser profile. Shared view
  links contain a configuration snapshot and require source access.
- Cross-Workspace page references and collaborative version history remain
  future work. Japanese IME and native mobile/desktop behavior need further use.
- Notion import/export is a preview migration, not two-way synchronization.
  CSV properties become text; views, relations, formulas, permissions and history
  are not reconstructed. Notion ZIP media placement depends on its importer.
- The user confirmed a video successfully imported into Notion from an exported
  ZIP. Live application-token direct transfer and live multipart into Notion
  remain separate acceptance items; automated payload/failure tests cover both.
