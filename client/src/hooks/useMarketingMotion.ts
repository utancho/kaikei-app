import { useEffect } from "react";

export function useMarketingMotion(enabled: boolean) {
  useEffect(() => {
    const site = document.querySelector<HTMLElement>(".keirio-studio");
    if (!site) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let cleanup = () => {};
    const configure = () => {
      cleanup();
      const running = enabled && !preference.matches;
      site.dataset.motion = running ? "on" : "off";
      if (!running) return;
      const observed = new Set<Element>();
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.reveal = "visible";
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
      const scan = () => {
        site.querySelectorAll<HTMLElement>(".studio-intro h2,.studio-features>.studio-display,.studio-specs>div,.studio-pricing>div,.journal-card,.studio-utilities>div,.help-heading,.studio-final h2").forEach((element, index) => {
          if (observed.has(element)) return;
          observed.add(element);
          element.style.setProperty("--reveal-delay", (index % 3) * 70 + "ms");
          element.dataset.reveal = element.getBoundingClientRect().top < innerHeight - 30 ? "visible" : "waiting";
          observer.observe(element);
        });
      };
      scan();
      const mutation = new MutationObserver(scan);
      mutation.observe(site, { childList: true, subtree: true });
      let raf = 0;
      let x = 0, y = 0;
      const update = () => {
        raf = 0;
        const hero = site.querySelector<HTMLElement>(".studio-hero");
        const bounds = hero?.getBoundingClientRect();
        const progress = bounds ? Math.max(0, Math.min(1, -bounds.top / bounds.height)) : 0;
        site.style.setProperty("--hero-shift", (-progress * 36).toFixed(2) + "px");
        site.style.setProperty("--pointer-x", x.toFixed(3));
        site.style.setProperty("--pointer-y", y.toFixed(3));
        const length = document.documentElement.scrollHeight - innerHeight;
        site.style.setProperty("--page-progress", String(length > 0 ? scrollY / length : 0));
      };
      const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
      const pointer = (event: PointerEvent) => {
        const grid = site.querySelector(".refined-hero-grid")?.getBoundingClientRect();
        if (fine.matches && grid && event.clientY >= grid.top && event.clientY <= grid.bottom) {
          x = Math.max(-1, Math.min(1, (event.clientX - grid.left) / grid.width * 2 - 1));
          y = Math.max(-1, Math.min(1, (event.clientY - grid.top) / grid.height * 2 - 1));
        } else { x = 0; y = 0; }
        schedule();
      };
      const leave = () => { x = 0; y = 0; schedule(); };
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      window.addEventListener("pointermove", pointer, { passive: true });
      document.addEventListener("pointerleave", leave);
      schedule();
      cleanup = () => {
        observer.disconnect(); mutation.disconnect(); cancelAnimationFrame(raf);
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        window.removeEventListener("pointermove", pointer);
        document.removeEventListener("pointerleave", leave);
        site.querySelectorAll<HTMLElement>("[data-reveal]").forEach(element => delete element.dataset.reveal);
        for (const variable of ["--hero-shift", "--pointer-x", "--pointer-y", "--page-progress"]) site.style.removeProperty(variable);
      };
    };
    configure();
    preference.addEventListener("change", configure);
    return () => { cleanup(); preference.removeEventListener("change", configure); delete site.dataset.motion; };
  }, [enabled]);
}
