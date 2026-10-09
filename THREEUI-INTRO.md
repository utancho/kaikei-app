# Registered ThreeUI intro

Source: https://threeui.com/source-code/threeui-intro.json

The complete, unmodified registered bundle is stored in
`threeui-intro.source.json`. The Vite plugin verifies all three registered
SHA-256 values on each build.

`client/threeui-intro-plugin.ts` selects the original intro definition and its
original React/isolation runtime directly from that bundle. The only content
adaptation is `ThreeUI` → `keirio`, with the same icon artwork used by the
desktop app (`desktop/build/icon.png`) embedded in its authored logo slot.
A ready message connects the original
iframe to the site's entrance overlay. Timing, character choreography,
canonical HTML and color props are retained.

The package export is routed to this source-backed intro; other ThreeUI
components keep their normal package implementations. Import usage stays
`TextAnimationCollection variant="threeui-intro" mode="dark"` with hue 0,
saturation 1, brightness 1.

Dependency: @designcodeio/threeui 1.2.0, MIT. Preserve the package's LICENSE and
THIRD_PARTY_NOTICES; the source is not a reconstruction from its preview.
