# Tsuzunowa branding

The product name is **Tsuzunowa（つづのわ）**. It combines 綴る (tsuzuru,
to write or bind together) and 輪 (wa, a circle).

## Display names

The Web, desktop, and mobile HTML titles, Web installation manifest, shared
sign-in and recovery screens, server landing page, email text and subjects,
and default server names use Tsuzunowa. New welcome content and the seed
workspace use the new name; existing user-authored content and configured
server names are not rewritten.

The Web build uses `public/manifest.json` as its only installation manifest.
The PWA plugin does not generate a second manifest from the internal npm
package name. An already installed Web app may take time to pick up a new name
until the browser refreshes its installation metadata.

Desktop packaging labels and the executable name use Tsuzunowa. Its release
publisher and update source point to `hogawish/tsuzunowa`. This changes the
source configuration; it does not publish an installer or validate an update
installation.

## Compatibility and attribution

Internal `@colanode/*` package names, client bridge names, database and browser
storage keys remain compatible with the existing preview. The desktop preview
continues to use its existing `appData/Colanode` profile directory, explicitly
created before Electron is asked to use it. The name change does not move,
clear, or start a separate copy of that profile. A future independent desktop
distribution needs its profile migration and coexistence behavior reviewed
alongside installer validation.

Colanode remains named in upstream attribution, original author metadata, and
labels for the actual Colanode Cloud service. It is not the name of this fork.
See [origins and changes](../FORK.md) and the [license](../LICENSE).

## Logo and app icons

The owner selected the two-notebook and circular-ring mark on 2026-11-27.
The approved [source SVG](../assets/branding/tsuzunowa-symbol.svg) drives the
shared sign-in mark, Web favicon and PWA icons, desktop icon containers, and
mobile icon/splash assets. The exposed rear ring is slightly lighter than the
front ring as an optical correction. The mark uses its approved paper backdrop;
it is not recolored by the page theme or the inherited Colanode drawing animation.

The full mark is retained at small sizes. Maskable/adaptive versions apply a
uniform safe-area inset. The owner selected the E2 wordmark on the same date:
Fraunces 500, optical size 72, softness 100, wonk 1 and -0.015em tracking.
The [wordmark SVG](../assets/branding/tsuzunowa-wordmark.svg) contains outlines,
so it does not depend on installed fonts or a network font service. Shared
sign-in screens use those outlines; ordinary application text keeps its existing
typeface. See the
[asset generation guide](../assets/branding/README.md) for source, regeneration,
and platform formats. Generated copies are refreshed by postinstall so a fresh
installation cannot restore the old mark.

## Validation scope

The display-name change was checked with shared-UI, Web, and server production
builds; startup recovery and desktop-profile filesystem regressions; and the
built Web app in a fresh headless browser profile. Browser checks cover the
tab title, sign-in heading, and single installation manifest in light and dark
themes. They do not cover a native desktop/mobile installer, existing OS
shortcuts, or an already installed PWA's metadata refresh.

The approved mark was checked with shared-UI and Web production builds, lint
for the changed TypeScript files, SVG-to-raster equality, ICO/ICNS frame decoding,
and adaptive-icon safe-area bounds. The built Web app was also checked for
actual navy and orange pixels in both light and dark themes, using an isolated
browser profile. These checks do not validate native installation or OS icon
selection. The selected E2 wordmark is included in the shared sign-in screen.
