import { lazy, Suspense, useEffect, useRef, useState } from "react";

const IntroScene = lazy(() => import("./IntroTextScene").then(module => ({ default: module.Scene })));
const STORAGE_KEY = "keirio:intro:v1";
export default function EntranceIntro() {
  const [show, setShow] = useState(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || location.hash) return false;
    try { return sessionStorage.getItem(STORAGE_KEY) !== "seen"; } catch { return true; }
  });
  const [leaving, setLeaving] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const finish = () => setLeaving(true);
  useEffect(() => {
    if (!show) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const siblings = [...(wrapper.current?.parentElement?.children ?? [])].filter(element => element !== wrapper.current) as HTMLElement[];
    const oldInert = siblings.map(element => element.inert);
    siblings.forEach(element => { element.inert = true; });
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => { if (preference.matches) setLeaving(true); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLeaving(true);
      if (event.key === "Tab") { event.preventDefault(); skip.current?.focus(); }
    };
    const timer = window.setTimeout(() => setLeaving(true), 5500);
    document.addEventListener("keydown", escape);
    preference.addEventListener("change", changed);
    return () => {
      document.body.style.overflow = oldOverflow;
      siblings.forEach((element, index) => { element.inert = oldInert[index]; });
      clearTimeout(timer);
      document.removeEventListener("keydown", escape);
      preference.removeEventListener("change", changed);
      if (!wrapper.current) document.querySelector<HTMLAnchorElement>(".studio-hero-actions a")?.focus({ preventScroll: true });
    };
  }, [show]);
  useEffect(() => {
    if (!show || leaving) return;
    // Start the single authored beat after its srcDoc has isolated the scene.
    let timer: number | undefined;
    const onReady = (event: MessageEvent) => {
      const frame = wrapper.current?.querySelector("iframe");
      if (event.source === frame?.contentWindow && event.data?.keirioIntroReady && timer === undefined) {
        timer = window.setTimeout(() => setLeaving(true), 2400);
      }
    };
    window.addEventListener("message", onReady);
    return () => { window.removeEventListener("message", onReady); window.clearTimeout(timer); };
  }, [show, leaving]);
  useEffect(() => {
    if (!leaving) return;
    try { sessionStorage.setItem(STORAGE_KEY, "seen"); } catch { /* still allow entry */ }
    const timer = window.setTimeout(() => setShow(false), 350);
    return () => clearTimeout(timer);
  }, [leaving]);
  if (!show) return null;
  return <div ref={wrapper} className={"entrance-intro" + (leaving ? " is-leaving" : "")} role="dialog" aria-modal="true" aria-label="keirio イントロ">
    <div className="intro-scene" aria-hidden="true"><Suspense fallback={<span className="intro-fallback">keirio</span>}><IntroScene /></Suspense></div>
    <button ref={skip} type="button" className="intro-skip" onClick={finish} autoFocus>スキップ →</button>
    <p className="intro-caption">日々の記帳から、経営の判断まで。</p>
  </div>;
}
