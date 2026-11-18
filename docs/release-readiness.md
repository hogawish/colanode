# Sharing and Space views: release readiness

Proposed release: **fork-0.2.0-alpha.1**, an alpha source preview for the Web app
and a self-hosted API. Status on 2026-11-18: **prepared, not approved for publication**.
No tag, GitHub Release, or hosted-service deployment has been made for this candidate.

## Included scope

[Release notes](releases/fork-0.2.0-alpha.1.md) cover page sharing and invitations,
permission management, original-page references, Space search/tags/member filters,
saved view links, personal Hide/pins, any/all quick filters, and grouped AND/OR filters.
[Usage](sharing-and-space-views.md) records the limits and access semantics.
The candidate also preserves deployed startup, cache, cold-load, and toggle fixes.
Locale-specific JST display changes are excluded; existing locale behavior remains.

## Completed validation

- Clean Node 22.23.5 dependency installation, TypeScript checks for shared packages
  and the server, and production Web/API builds.
- Web suite: **219 passing tests in 34 files**. Related record activity: **2 passing tests**.
- API suite: **21 passing tests in 10 files**, using fresh isolated PostgreSQL/Redis.
  These include viewer/editor inheritance, revocation, blocked sibling/foreign-workspace
  access, linked-database source checks, unused-file download denial, invitation
  identity/expiry/reuse checks, and stale-save rejection.
- Public Dockerfiles both build from a tracked-source archive. The API serves
  /config and / with HTTP 200; the Nginx image returns the app on a deep page URL.
  These are startup checks, not a replacement for interactive browser acceptance.
- All 32 migrations present in fork-0.1.0-alpha.1 are byte-identical. A synthetic
  initial-schema fixture includes account/workspace/user, Space, parent/child pages,
  document/CRDT state, database/record, and an uploaded file. Applying 00033/00034
  preserves every existing row and the file SHA. Restoring a PostgreSQL custom dump
  and matching upload archive into a separate empty database restores the same
  rows and bytes at schema 32. This verifies schema/data migration and backup
  restoration; it does not boot the old release or test a live installation.
- Changed-file scan of 143 paths found no private-key blocks, GitHub/API token
  patterns, or machine-specific user/project paths. This is a limited pattern scan.

## Required before publication

1. **Remediate and reassess runtime dependencies.** npm audit --omit=dev on the
   actual API distribution reports 28 affected package entries: 1 critical,
   16 high, 9 moderate, 2 low. Advisory/package counts are not counts of proven
   exploitable application paths. No automatic dependency upgrade was applied.
2. After those changes, repeat the affected tests and build/startup checks on the
   fixed source. Review remaining advisory reachability for the shipped Web/API;
   the whole monorepo report also contains mobile and build-tool dependencies.
3. Perform one acceptance pass of the final candidate: invite a guest, read/edit
   a shared child, revoke access, open a Space page reference, save/open a grouped
   filter link as another member, and confirm personal Hide stays personal.
4. Obtain the Human's final approval for the source tag and GitHub prerelease.
   Public binaries/images, normal-service deployment, and internet exposure are
   separate from this proposed source preview.

### Dependency findings requiring follow-up

| Component                                                    | Observation                                                                                                                                  | Follow-up                                                                                            |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Handlebars                                                   | Critical advisory affects installed 4.7.9; application compiles bundled template files, not a user-supplied template in the paths inspected. | Update to patched release and verify templates. Reachable code execution has not been established.   |
| sharp/libvips                                                | Image upload and Google-avatar conversion pass external bytes to sharp.                                                                      | Update the native image stack and verify Node/runtime compatibility and image processing.            |
| Nodemailer                                                   | Runtime SMTP client; disabled in the local test configuration.                                                                               | Update and verify configured SMTP behavior; disabling test email does not assess deployed SMTP risk. |
| Fastify, router, Zod, Kysely, XML and WebSocket dependencies | High-severity entries remain in the distribution.                                                                                            | Update within supported ranges where possible and check each advisory's actual use.                  |
| Scripts workspace dependencies                               | Icon/emoji tooling is included by the current image workspace installation.                                                                  | Separate build-time tools from runtime and reassess the resulting image.                             |

Sources: [Handlebars advisory](https://github.com/advisories/GHSA-p8wg-vrv2-v86f),
[sharp/libvips advisory](https://github.com/advisories/GHSA-f88m-g3jw-g9cj),
[Nodemailer advisory](https://github.com/advisories/GHSA-6vj9-mwq6-2f5v).
The complete machine-readable audit was retained with the local preparation evidence.

## Human decision

Recommended publication format: **GitHub prerelease, source only, fork-0.2.0-alpha.1**,
with sharing and Space views as its focus. This keeps the current alpha distribution
model; native installers and published container images are outside this release.
Do not publish the present candidate while dependency remediation remains open.
Technical dependency choices do not require the Human to accept known vulnerabilities.
