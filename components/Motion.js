"use client";
import { useEffect } from "react";
import Lenis from "lenis";

// Scroll suave + revelado de títulos/imágenes + parallax + ancho variable del logotipo.
export default function Motion() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lenis = null;
    if (!reduce) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      window.__lenis = lenis;
    }

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      }),
      { rootMargin: "0px 0px -12% 0px" },
    );
    const watch = () => document.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => io.observe(el));
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });

    const parallax = [...document.querySelectorAll("[data-parallax]")];
    const marks = [...document.querySelectorAll("[data-stretch]")];
    const process = document.querySelector("[data-process]");
    const rail = process?.querySelector(".rail");

    // en celular los pasos se apilan: sin sección fija ni desplazamiento horizontal
    const narrow = () => window.innerWidth <= 640;
    const sizeProcess = () => {
      if (!process || !rail || reduce) return;
      if (narrow()) { process.style.height = ""; rail.style.transform = ""; return; }
      const extra = rail.scrollWidth - window.innerWidth;
      process.style.height = `${window.innerHeight + Math.max(0, extra)}px`;
    };
    sizeProcess();

    let raf = 0;
    const frame = (t) => {
      lenis?.raf(t);
      const vh = window.innerHeight;
      for (const el of parallax) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        const p = (r.top + r.height / 2 - vh / 2) / vh; // -1..1
        el.style.setProperty("--py", `${(p * -60).toFixed(1)}px`);
      }
      for (const el of marks) {
        const r = el.getBoundingClientRect();
        const mode = el.dataset.stretch;
        let w;
        if (mode === "out") {
          // logotipo del hero: se aplasta y ensancha a medida que sale de pantalla
          const p = Math.min(1, Math.max(0, (vh - r.bottom) / (vh * 0.9)));
          w = 62 + p * 63;
        } else {
          // logotipo del pie: entra ancho y se levanta hasta su altura completa
          const p = Math.min(1, Math.max(0, (vh - r.top) / (el.offsetHeight + 20)));
          w = 125 - p * 63;
        }
        if (el.classList.contains("ready")) el.style.setProperty("--w", w.toFixed(1));
      }
      if (process && rail && !reduce && !narrow()) {
        const r = process.getBoundingClientRect();
        const total = process.offsetHeight - vh;
        const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
        rail.style.transform = `translate3d(${-(rail.scrollWidth - window.innerWidth) * p}px,0,0)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onClick = (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
      else target.scrollIntoView({ behavior: "smooth" });
    };
    document.addEventListener("click", onClick);
    window.addEventListener("resize", sizeProcess);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect(); mo.disconnect();
      document.removeEventListener("click", onClick);
      window.removeEventListener("resize", sizeProcess);
      lenis?.destroy();
    };
  }, []);
  return null;
}

export function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.__lenis) window.__lenis.scrollTo(el, { duration: 1.2 });
  else el.scrollIntoView({ behavior: "smooth" });
}
