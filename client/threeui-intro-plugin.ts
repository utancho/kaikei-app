import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { transformWithEsbuild, type Plugin } from "vite";

// The registered bundle stays untouched. These exact source ranges contain the
// selected effect's types, defaults, isolation and original React runtime.
// Only brand text and artwork are adapted; all authored timing is retained.
export function registeredKeirioIntro(): Plugin {
  const bundle = JSON.parse(readFileSync(new URL("../threeui-intro.source.json", import.meta.url), "utf8")) as {
    files: { path: string; code: string; sha256: string }[];
  };
  const hashes = [
    "fe9856234253bc3c1a13b3afb84f3d84644dfa6d578e7203bb3e1dd5eced1b75",
    "e14795f24ea8aa9cb0005ea740923289869de3250ac4ea18f58527cd42e18cbe",
    "efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf",
  ];
  for (const hash of hashes) {
    const file = bundle.files.find(file => file.sha256 === hash);
    if (!file || createHash("sha256").update(file.code).digest("hex") !== hash) {
      throw new Error("ThreeUI registered intro source failed SHA-256 verification");
    }
  }
  const component = bundle.files.find(file => file.path.endsWith("NeuformIsolatedEffects.tsx"))!.code;
  const canonical = bundle.files.find(file => file.path.endsWith("creator-studio-intro.html"))!.code;
  const appIcon = readFileSync(new URL("../desktop/build/icon.png", import.meta.url)).toString("base64");
  const brandSvg = '<svg viewBox="0 0 1024 1024" aria-hidden="true"><image width="1024" height="1024" href="data:image/png;base64,' + appIcon + '"/></svg>';
  const range = (start: string, end: string) => {
    const a = component.indexOf(start);
    const b = component.indexOf(end, a);
    if (a < 0 || b < 0) throw new Error("ThreeUI registered source range changed");
    return component.slice(a, b);
  };
  const definition = range("  threeUIIntro: {", "  particleWordmark: {")
    .replace('text: "ThreeUI"', 'text: "keirio"')
    .replace("logoSvg: THREEUI_MARK_SVG", "logoSvg: " + JSON.stringify(brandSvg));
  const exactRuntime = [
    'import { useEffect, useMemo, useRef, type CSSProperties } from "react";',
    range("type FocusRole =", "const SHADERS_WORDMARK_SVG"),
    range("export type NeuformIsolatedEffectProps =", "/* ------------------------------------------------------------------ *"),
    "const creatorStudioIntroSource = " + JSON.stringify(canonical) + ";",
    "const EFFECTS = {\n" + definition + "\n};",
    range("function clamp(", "export const ExpanseField").replace(
      "document.body.setAttribute('data-threeui-ready', '');",
      "document.body.setAttribute('data-threeui-ready', ''); window.parent.postMessage({ keirioIntroReady: true }, '*');",
    ),
    "const RegisteredKeirioIntro = createEffectComponent(EFFECTS.threeUIIntro);",
  ].join("\n").replace(/\bexport /g, "");
  return {
    name: "registered-threeui-keirio-intro",
    enforce: "pre",
    async transform(code, id) {
      if (!id.split("?")[0].replace(/\\/g, "/").endsWith("/neuform-isolated/NeuformIsolatedEffects.js")) return;
      const exportPattern = /\b\w+ as ThreeUIIntro\b/g;
      if ((code.match(exportPattern) ?? []).length !== 1) throw new Error("ThreeUI intro export changed");
      const compiled = await transformWithEsbuild(exactRuntime, "registered-keirio-intro.tsx", { loader: "tsx", jsx: "automatic" });
      return {
        code: code.replace(exportPattern, "RegisteredKeirioIntro as ThreeUIIntro") + "\n" + compiled.code,
        map: null,
      };
    },
  };
}
