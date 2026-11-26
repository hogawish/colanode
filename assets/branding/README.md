# Tsuzunowa mark

`tsuzunowa-symbol.svg` is the approved source, selected on 2026-11-27 after
review with the owner, Akari, Nagi and Mio. It depicts two notebooks bound by
one circular ring, with an editorial t on the front cover. The ring preserves
its circular centerline; the exposed rear arc is optically lighter (45 units)
than the front arc (48 units). The final t placement is slightly outward.

The wordmark is the owner-selected **E2**: Fraunces 500, `opsz=72`, `SOFT=100`,
`WONK=1`, with `-0.015em` tracking. `tsuzunowa-wordmark.svg` preserves its glyph
outlines, and `wordmark.json` records the source font hash and layout. The
unchanged text-subset font is retained under `fonts/` with its SIL Open Font
License. The application renders the outlines without loading a font file.
`tsuzunowa-lockup.svg` combines the approved icon and wordmark at the reviewed
150px icon / 70px wordmark line-box ratio, with 22px separation and right padding.

Keep this geometry, palette and layering when regenerating assets. The source
is native vector artwork; raster exploration images are not build inputs.

From the repository root, after installing the existing workspace dependencies:

```sh
npm run generate:branding --workspace=@colanode/scripts
npm exec tsx scripts/src/postinstall/index.ts
```

The generator uses the server's existing Sharp dependency and the root Prettier
tool. No new dependency, external service or API key is needed. It creates PNGs,
a multi-size PNG-based ICO, a PNG-based ICNS, mobile assets and the shared React
component, outlined wordmark and horizontal lockup PNG. Generated binary source
assets are committed so normal installation
only needs to copy them. The shared component embeds the unchanged SVG as an
isolated image so its masks and gradients are independent of surrounding theme
CSS and other logo instances.

The approved full mark is retained at small sizes; a separate simplified favicon
has not been designed or silently substituted. Maskable and adaptive variants
use the same artwork uniformly inset by 0.88, without changing individual parts.
Only the adaptive foreground omits the outer paper backdrop; the notebook faces
and overlap clearances stay opaque. The mobile background is the paper color.

ICO frames: 16, 24, 32, 48, 64, 128 and 256px. ICNS includes modern PNG entries
from 16 to 1024px and retina entries. Native Windows/macOS installation and
mobile OS rendering must be checked as part of a platform release; generating
these containers does not validate an installer.

The mark and logo artwork are Tsuzunowa modifications by hogawish under
the repository's Apache 2.0 license. The bundled Fraunces font remains under
its own SIL Open Font License; it is not relicensed as Apache 2.0. Upstream
Colanode notices remain in effect. This artwork selection does not assert
trademark registration or legal clearance.
