<!-- Modified by hogawish: introduce Tsuzunowa, its source preview, and Colanode origins. -->

# Tsuzunowa（つづのわ）

**One original. Many ways to work together.**

Tsuzunowa is an open-source, local-first collaboration workspace for pages,
databases, and files. Keep a page in one place, share it with the people who need
it, and open that same original from different Spaces.

The name combines **綴る (tsuzuru, to write or bind together)** and
**輪 (wa, a circle)**: bring your work together and extend the circle of people
who can work with it.

> **Built on Colanode.** Tsuzunowa is an independently maintained fork of
> [Colanode](https://github.com/colanode/colanode), not an official Colanode release
> or service. We retain the upstream Apache 2.0 license and attribution.
> See [FORK.md](FORK.md) for the development history and changes.

[Latest source preview](https://github.com/hogawish/tsuzunowa/releases/tag/fork-0.2.0-alpha.1)
· [Roadmap and discussion](https://github.com/hogawish/tsuzunowa/issues/1)
· [Report a problem](https://github.com/hogawish/tsuzunowa/issues)
· [Apache 2.0](LICENSE)

## What you can do

- **Write and organize together.** Use rich-text pages, images, videos, files,
  structured databases, table and board views, and real-time editing.
- **Share the original page.** Invite people with view or edit access. Shared
  pages appear in **Shared with me**, with inherited access to child pages.
  Add a reference in another Space's sidebar to open the same original.
- **Find your Spaces.** Search names, filter by members and tags, combine AND/OR
  groups, and save named views as links. Personal pins, sorting, and Hide help
  keep your own sidebar useful.
- **Work directly with blocks and records.** Copy block links, change block
  formatting and background colors, select rows for bulk actions, and drag
  records in a saved manual order or move cards on a board.
- **Move content between tools.** Export HTML or PDF, or use Notion ZIP to carry
  page hierarchies, database CSVs, and original body attachments. Import Notion
  HTML/Markdown and CSV exports into new pages and databases.

**Current development focus: sharing and Notion migration.** We want people to
collaborate around one original and carry their content to other tools.

## Sharing without duplicating pages

Workspaces contain Spaces; Spaces organize pages and databases. A page reference
in another Space points to the original page, rather than creating a copy.
The reader still needs access to the source page. References and saved-view
links do not grant access by themselves.

Page sharing works within one Workspace. Parent-page grants extend to descendant
pages and owned databases; keep private internal notes outside a shared parent.
Page editing, database operations, and access administration have distinct
permission rules. See [sharing and Space views](docs/sharing-and-space-views.md)
before setting up a shared project.

## Try the source preview

**Tsuzunowa is in alpha.** The current public release is a source preview for
the self-hosted Web client and API, published under its earlier tag
`fork-0.2.0-alpha.1`. There are no Tsuzunowa-branded desktop installers or
prebuilt container releases yet. The official Colanode apps and cloud service
do not include these fork-specific features.

With Git, Docker, and Docker Compose installed:

```sh
git clone --branch fork-0.2.0-alpha.1 https://github.com/hogawish/tsuzunowa.git tsuzunowa
cd tsuzunowa
docker compose -p colanode-fork-preview -f hosting/docker/fork-preview.yaml up -d --build
```

1. Open the [local Web app](http://localhost:4000).
2. In **Add a server**, enter `http://localhost:3000/config`.
3. Create a local account and a Workspace.

The preview binds to loopback ports 3000 and 4000 and stores the database and
uploaded files in named Docker volumes. The Compose project name remains
`colanode-fork-preview` so existing preview users keep the same volumes.
This configuration is for local evaluation; review the configuration before
exposing a server to other people.

To stop the preview and keep its data:

```sh
docker compose -p colanode-fork-preview -f hosting/docker/fork-preview.yaml down
```

For upgrades and recovery, follow the
[release notes](docs/releases/fork-0.2.0-alpha.1.md), including backing up both
the database and uploaded files. Deploy matching Web and API versions.

Some application, package, and configuration names still use `colanode` while
the Tsuzunowa naming transition is in progress.

## Import and export

Open **settings gear → Export page** to export a page, record, database view,
or shared page. Notion ZIP can include subpages, databases, and referenced body
attachments, including images, video, audio, PDFs, and other files without
transcoding.

This is content migration, not continuous synchronization or a complete backup:

- Notion's ZIP importer may change formatting or retain some media as links.
  File import does not reliably recreate native inline databases or attach
  each exported row's HTML body to its corresponding CSV record.
- Imported CSV properties start as text. Views, formulas, relations, permissions,
  comments, and edit history are not recreated with full fidelity.
- A separate **Copy directly to Notion** option can create native media and
  inline database blocks using a user-supplied Notion connection. This route
  remains experimental; real application-token transfer has not been verified
  in the public release acceptance.

See [the import/export guide](docs/page-export.md) for supported content,
file limits, setup, and validation evidence.

## Development

Use Node.js 22.13 or later in the supported Node 22 line, the committed lockfile,
and Docker for the supporting services and server tests.

```sh
git clone https://github.com/hogawish/tsuzunowa.git tsuzunowa
cd tsuzunowa
npm ci
```

The monorepo keeps apps under `apps/` and shared code under `packages/`.
Internal workspace packages currently use `@colanode/*` names.

- `apps/server`: Fastify API, Postgres, Redis-compatible service, and file storage.
- `apps/web`: browser client.
- `apps/desktop` and `apps/mobile`: inherited client sources; not part of this
  preview's validated release targets.
- `packages/core`, `client`, `crdt`, and `ui`: shared types, local data and sync,
  Yjs documents, and interface components.

The inherited client architecture caches data locally and uses Yjs CRDTs for
collaborative editing. Individual sharing and migration operations also use
authenticated server requests; do not assume every feature works offline.

See [repository guidelines](AGENTS.md), the
[server guide](apps/server/README.md), and
[reproducible checks](FORK.md#reproduce-checks) for setup and validation.
Please report Tsuzunowa-specific issues in
[this repository](https://github.com/hogawish/tsuzunowa/issues).

## Origins and license

Tsuzunowa builds on the work of the
[Colanode contributors](https://github.com/colanode/colanode). The upstream
project supplies the foundation for local-first collaboration, rich-text
editing, databases, messaging, and file storage.

Tsuzunowa's modifications are Copyright 2026 hogawish and are provided under
the [Apache License, Version 2.0](LICENSE). Existing upstream copyright and
attribution notices remain in effect. No affiliation with or endorsement by
the Colanode project is implied.
