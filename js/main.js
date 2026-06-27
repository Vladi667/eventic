/* ============================================================
   EVENTIC — main orchestrator
   Lenis + GSAP motion dictionary + chrome UI + WebGL wiring.
   ============================================================ */
(function () {
  "use strict";

  const html = document.documentElement;
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- WebGL capability probe ----
  const WEBGL_OK = (function () {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  })();
  if (!WEBGL_OK) html.classList.add("no-webgl");

  const ACCENT = {
    light: {
      rim: "rgba(166,212,0,0.9)", rimEdge: "rgba(166,212,0,0)",
      vec: new (window.THREE ? THREE.Vector3 : function(){})(0.65, 0.83, 0.0),
      body: ["#6c7176", "#3a3e40", "#202325", "#0c0d0e"], // dark graphite — pops on white
    },
    dark: {
      rim: "rgba(212,255,61,0.95)", rimEdge: "rgba(212,255,61,0)",
      vec: new (window.THREE ? THREE.Vector3 : function(){})(0.83, 1.0, 0.24),
      body: ["#ffffff", "#d2d8d0", "#9aa39c", "#565d55"], // polished chrome — pops on black
    },
  };

  /* ========================================================
     THEME (lights on/off)
     ======================================================== */
  const THEME_KEY = "eventic-theme";
  function applyTheme(t) {
    html.setAttribute("data-theme", t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#0A0B0A" : "#F4F5F4");
    if (window.__metal && window.THREE) window.__metal.setAccent(t === "dark" ? ACCENT.dark : ACCENT.light);
  }
  (function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved || "light");
  })();
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  });

  /* ========================================================
     LIVE CLOCK
     ======================================================== */
  const clockEls = document.querySelectorAll("[data-clock]");
  function tickClock() {
    const d = new Date();
    const s = d.toLocaleTimeString("en-GB", { hour12: false });
    clockEls.forEach((el) => (el.textContent = s));
  }
  if (clockEls.length) { tickClock(); setInterval(tickClock, 1000); }

  /* ========================================================
     DECODE LABELS (scramble-settle on hover)
     ======================================================== */
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/";
  function decodeBind(el) {
    // operate on the first text node so nested spans survive
    let node = null;
    for (const n of el.childNodes) { if (n.nodeType === 3 && n.textContent.trim()) { node = n; break; } }
    if (!node) return;
    const original = node.textContent;
    let raf = null;
    function run() {
      cancelAnimationFrame(raf);
      const len = original.length;
      let frame = 0;
      const total = 12 + len;
      (function loop() {
        let out = "";
        for (let i = 0; i < len; i++) {
          if (original[i] === " ") { out += " "; continue; }
          if (i < (frame - 8)) out += original[i];
          else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        node.textContent = out;
        frame++;
        if (frame <= total) raf = requestAnimationFrame(loop);
        else node.textContent = original;
      })();
    }
    el.addEventListener("mouseenter", run);
    el.addEventListener("focus", run);
  }
  if (!REDUCED) document.querySelectorAll(".decode").forEach(decodeBind);

  /* ========================================================
     MAGNETIC BUTTONS
     ======================================================== */
  function magnetic(el) {
    const inner = el.querySelector(".mag-inner") || el;
    const strength = 0.4;
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      inner.style.transform = `translate(${x * strength * 0.4}px, ${y * strength * 0.4}px)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = ""; inner.style.transform = "";
    });
  }
  if (!REDUCED) document.querySelectorAll("[data-magnetic]").forEach(magnetic);

  /* ========================================================
     MENU OVERLAY
     ======================================================== */
  const menu = document.querySelector("[data-menu]");
  const menuOpenBtns = document.querySelectorAll("[data-menu-open]");
  const menuCloseBtns = document.querySelectorAll("[data-menu-close]");
  let lastFocus = null;
  function openMenu() {
    if (!menu) return;
    lastFocus = document.activeElement;
    menu.classList.add("open");
    menuOpenBtns.forEach((b) => b.setAttribute("aria-expanded", "true"));
    const first = menu.querySelector("a, button");
    if (first) first.focus();
    document.addEventListener("keydown", escClose);
  }
  function closeMenu() {
    if (!menu) return;
    menu.classList.remove("open");
    menuOpenBtns.forEach((b) => b.setAttribute("aria-expanded", "false"));
    document.removeEventListener("keydown", escClose);
    if (lastFocus) lastFocus.focus();
  }
  function escClose(e) { if (e.key === "Escape") closeMenu(); }
  menuOpenBtns.forEach((b) => b.addEventListener("click", openMenu));
  menuCloseBtns.forEach((b) => b.addEventListener("click", closeMenu));

  /* ========================================================
     INK PAGE TRANSITIONS
     ======================================================== */
  const inkSheet = document.querySelector(".ink-sheet");
  const inkMark = inkSheet ? inkSheet.querySelector(".ink-mark") : null;
  const INK_KEY = "eventic-ink";

  function drainInk() {
    if (!inkSheet || REDUCED || !window.gsap) return;
    gsap.set(inkSheet, { yProperty: "yPercent", yPercent: 0 });
    gsap.set(inkSheet, { yPercent: 0 });
    gsap.set(inkMark, { opacity: 1 });
    const tl = gsap.timeline();
    tl.to(inkMark, { opacity: 0, duration: 0.3 })
      .to(inkSheet, { yPercent: -100, duration: 0.7, ease: "power3.inOut" }, "-=0.1")
      .set(inkSheet, { yPercent: 100 });
  }
  function coverInk(href) {
    if (!inkSheet || REDUCED || !window.gsap) { window.location.href = href; return; }
    sessionStorage.setItem(INK_KEY, "1");
    const tl = gsap.timeline({ onComplete: () => (window.location.href = href) });
    gsap.set(inkSheet, { yPercent: 100 });
    gsap.set(inkMark, { opacity: 0 });
    tl.to(inkSheet, { yPercent: 0, duration: 0.6, ease: "power3.inOut" })
      .to(inkMark, { opacity: 1, duration: 0.3 }, "-=0.25");
  }
  function isInternal(a) {
    const href = a.getAttribute("href") || "";
    if (a.target === "_blank") return false;
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) return false;
    if (/^https?:\/\//i.test(href) && a.host !== window.location.host) return false;
    return href.length > 0;
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a || !isInternal(a)) return;
    const url = new URL(a.href, window.location.href);
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    e.preventDefault();
    coverInk(a.href);
  });
  if (sessionStorage.getItem(INK_KEY)) { sessionStorage.removeItem(INK_KEY); window.addEventListener("DOMContentLoaded", drainInk); drainInk(); }

  /* ========================================================
     LENIS SMOOTH SCROLL
     ======================================================== */
  let lenis = null, scrollVel = 0;
  if (!REDUCED && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on("scroll", (e) => { scrollVel = e.velocity || 0; });
    function rafLenis(t) { lenis.raf(t); requestAnimationFrame(rafLenis); }
    requestAnimationFrame(rafLenis);
    if (window.gsap && window.ScrollTrigger) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  /* ========================================================
     PRELOADER (once per session)
     ======================================================== */
  const preloader = document.getElementById("preloader");
  function killPreloader() {
    if (!preloader) return;
    if (window.gsap && !REDUCED) {
      gsap.to(preloader, { opacity: 0, duration: 0.6, ease: "power2.out", onComplete: () => preloader.remove() });
    } else { preloader.remove(); }
  }
  function runPreloader(done) {
    if (!preloader || REDUCED || sessionStorage.getItem("eventic-preloaded")) {
      if (preloader) preloader.remove();
      done(); return;
    }
    sessionStorage.setItem("eventic-preloaded", "1");
    const numEl = preloader.querySelector(".pl-num");
    const bar = preloader.querySelector(".pl-bar i");
    const obj = { v: 0 };
    gsap.to(obj, {
      v: 100, duration: 1.6, ease: "power2.inOut",
      onUpdate() {
        const n = Math.round(obj.v);
        numEl.textContent = String(n).padStart(3, "0");
        if (bar) bar.style.width = n + "%";
      },
      onComplete() { killPreloader(); done(); },
    });
  }

  /* ========================================================
     MOTION DICTIONARY (gated behind fonts.ready)
     ======================================================== */
  function buildMotion() {
    if (!window.gsap) return;
    gsap.registerPlugin(ScrollTrigger);
    const hasSplit = !!window.SplitText;

    if (REDUCED) {
      // static: ensure everything visible
      gsap.set("[data-split], [data-reveal]", { opacity: 1, y: 0 });
      document.querySelectorAll(".hairline").forEach((h) => (h.style.transform = "scaleX(1)"));
      document.querySelectorAll("[data-count]").forEach((el) => (el.textContent = el.getAttribute("data-count")));
      return;
    }

    // hero wordmark
    const wmI = document.querySelector(".wm-i");
    if (wmI) gsap.from(wmI, { yPercent: 120, duration: 1.1, ease: "power4.out", delay: 0.1 });

    // headings rise out of clip-mask
    document.querySelectorAll("[data-split]").forEach((el) => {
      let targets;
      if (hasSplit) {
        const split = new SplitText(el, { type: "lines", mask: "lines", linesClass: "split-line" });
        targets = split.lines;
      } else {
        targets = [el];
      }
      gsap.from(targets, {
        yPercent: 115, duration: 1, ease: "power4.out", stagger: 0.08,
        scrollTrigger: { trigger: el, start: "top 85%" },
      });
    });

    // small labels reveal
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      gsap.from(el, { opacity: 0, y: 18, duration: 0.8, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 90%" } });
    });

    // hairlines draw themselves
    document.querySelectorAll(".hairline").forEach((h) => {
      gsap.to(h, { scaleX: 1, duration: 1, ease: "power3.inOut",
        scrollTrigger: { trigger: h, start: "top 92%" } });
    });

    // counters
    document.querySelectorAll("[data-count]").forEach((el) => {
      const target = parseFloat(el.getAttribute("data-count"));
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.8, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%" },
        onUpdate() { el.textContent = Math.round(obj.v); },
      });
    });

    // services rows entrance
    gsap.utils.toArray(".svc-row").forEach((row, i) => {
      gsap.from(row, { opacity: 0, y: 30, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: row, start: "top 90%" }, delay: i * 0.02 });
    });

    // work rows
    gsap.utils.toArray(".work-row").forEach((row) => {
      gsap.from(row, { opacity: 0, y: 24, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: row, start: "top 92%" } });
    });

    // footer assembles column-by-column
    const footCols = gsap.utils.toArray(".footer-grid > *");
    if (footCols.length) {
      gsap.from(footCols, { opacity: 0, y: 40, duration: 0.8, ease: "power3.out", stagger: 0.1,
        scrollTrigger: { trigger: ".site-footer", start: "top 80%" } });
    }

    // marquee — continuous drift + skew into scroll velocity
    const track = document.querySelector(".marquee-track");
    if (track) {
      const inner = track.firstElementChild;
      if (inner) { track.appendChild(inner.cloneNode(true)); track.appendChild(inner.cloneNode(true)); }
      let mx = 0;
      gsap.ticker.add(() => {
        mx -= 0.6;                       // calm, constant drift (no velocity skew)
        const w = track.scrollWidth / 3;
        if (-mx >= w) mx += w;
        track.style.transform = `translateX(${mx}px)`;
      });
    }

    // chapter rail wayfinding
    const sections = gsap.utils.toArray("[data-chapter]");
    const crNow = document.querySelector(".cr-now");
    const crName = document.querySelector(".cr-name");
    const crFill = document.querySelector(".cr-fill");
    const crTotal = document.querySelector(".cr-total");
    if (crTotal) crTotal.textContent = String(sections.length).padStart(2, "0");
    sections.forEach((sec, i) => {
      ScrollTrigger.create({
        trigger: sec, start: "top 50%", end: "bottom 50%",
        onToggle(self) {
          if (self.isActive) {
            if (crNow) crNow.textContent = String(i + 1).padStart(2, "0");
            if (crName) crName.textContent = sec.getAttribute("data-chapter");
          }
        },
      });
    });
    if (crFill) {
      ScrollTrigger.create({
        start: 0, end: "max",
        onUpdate(self) { crFill.style.height = (self.progress * 100).toFixed(1) + "%"; },
      });
    }

    // traveling ambient light descends with scroll (inner pages only —
    // on the home page the balloon carries its own halo instead)
    const ambient = document.querySelector(".ambient-light");
    if (ambient && !document.getElementById("balloon-stage")) {
      gsap.to(ambient, {
        top: "120vh", ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 1 },
      });
    }

    ScrollTrigger.refresh();
  }

  /* ========================================================
     WEBGL SURFACES
     ======================================================== */
  function initWebGL() {
    if (REDUCED || !WEBGL_OK) return;

    // ---- HERO FLUID ----
    const fluidCanvas = document.getElementById("fluid");
    let fluid = null;
    if (fluidCanvas && window.EventicFluid) {
      fluid = window.EventicFluid.start(fluidCanvas, {});
      window.__fluid = fluid;
    }
    // coverage pill
    const covEl = document.querySelector("[data-coverage]");
    if (fluid && covEl) {
      setInterval(() => {
        const c = Math.round(fluid.coverage() * 100);
        covEl.textContent = String(Math.min(99, Math.max(0, c))).padStart(2, "0");
      }, 200);
    }

    // ---- METAL SCENE ----
    const metalCanvas = document.getElementById("metal-canvas");
    let metal = null;
    if (metalCanvas && window.EventicMetal && window.THREE) {
      const t = html.getAttribute("data-theme");
      metal = window.EventicMetal.start(metalCanvas, { accent: t === "dark" ? ACCENT.dark : ACCENT.light });
      window.__metal = metal;
    }

    const heroSec = document.getElementById("hero");
    const metalSec = document.getElementById("metal-scene");
    let metalOn = false;

    // gate metal to visibility; pause fluid while metal renders (one heavy surface)
    if (metal && metalSec) {
      // gate to a central viewport band so the fixed canvas fades OUT
      // before the next section (prevents the sphere bleeding behind content)
      const mo = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          metalOn = en.isIntersecting;
          metal.setVisible(metalOn);
          metalCanvas.classList.toggle("visible", metalOn);
          if (metalOn && fluid) fluid.pause();
          else if (!metalOn && fluid && heroVisible) fluid.resume();
        });
      }, { threshold: 0, rootMargin: "-32% 0px -32% 0px" });
      mo.observe(metalSec);
    }

    let heroVisible = true;
    if (fluid && heroSec) {
      const ho = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          heroVisible = en.isIntersecting;
          if (heroVisible && !metalOn) fluid.resume();
          else if (!heroVisible) fluid.pause();
        });
      }, { threshold: 0.02 });
      ho.observe(heroSec);
    }

    // drive metal from pointer / scroll / click
    if (metal) {
      window.addEventListener("mousemove", (e) => {
        if (!metalOn) return;
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -((e.clientY / window.innerHeight) * 2 - 1);
        metal.setPointer(nx, ny);
      });
      window.addEventListener("click", (e) => { if (metalOn && metalSec.contains(document.elementFromPoint(e.clientX, e.clientY) || document.body)) metal.pulse(); });
      if (lenis) lenis.on("scroll", (ev) => metal.setScrollVel(ev.velocity || 0));
      else window.addEventListener("scroll", () => metal.setScrollVel(8));
    }
  }

  /* ========================================================
     BALLOON — cursor reaction + idle drift
     ======================================================== */
  function initBalloon() {
    const balloon = document.querySelector(".hero-balloon");
    if (!balloon || REDUCED) return;
    const floatG = balloon.querySelector(".balloon-float");
    const string = balloon.querySelector(".balloon-string");
    let tx = 0, ty = 0, cx = 0, cy = 0, t = 0;
    window.addEventListener("mousemove", (e) => {
      const r = balloon.getBoundingClientRect();
      const bx = r.left + r.width / 2, by = r.top + r.height / 2;
      tx = gsap.utils.clamp(-26, 26, (e.clientX - bx) * 0.05);
      ty = gsap.utils.clamp(-22, 22, (e.clientY - by) * 0.05);
    });
    if (window.gsap) {
      gsap.ticker.add(() => {
        t += 0.016;
        cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
        const driftX = Math.sin(t * 0.8) * 10;
        const driftY = Math.cos(t * 0.6) * 14;
        if (floatG) floatG.setAttribute("transform",
          `translate(${cx + driftX}, ${cy + driftY}) rotate(${cx * 0.25}, 110, 120)`);
        if (string) string.setAttribute("transform", `rotate(${-cx * 0.4}, 110, 232)`);
      });
    }
  }

  /* ========================================================
     HERO WORDMARK — balloon-as-letter + magnetic type
     (tactile & responsive; the balloon owns the stage)
     ======================================================== */
  function initHeroWordmark() {
    const wm = document.querySelector("[data-wordmark]");
    if (!wm || REDUCED || !window.gsap) return;
    const heroEl = document.getElementById("hero");
    const stage = wm.closest(".hero-frame");
    const word = wm.querySelector(".logo-word");
    const light = document.querySelector(".hero-light");
    const clamp = gsap.utils.clamp;

    let mx = -9999, my = -9999, active = false;
    heroEl.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; active = true; });
    heroEl.addEventListener("mouseleave", () => { active = false; });

    let rect = wm.getBoundingClientRect();
    function measure() { rect = wm.getBoundingClientRect(); }
    measure();
    window.addEventListener("resize", measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    // entrance: the hero rows stagger up once
    if (stage) gsap.from(stage.children, { opacity: 0, y: 28, duration: 1, ease: "power3.out", stagger: 0.1, delay: 0.15 });

    // the logo stays still; only a quiet cursor glow + a whisper of parallax
    let wx = 0, wy = 0;
    gsap.ticker.add(() => {
      if (light) {
        if (active) { light.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`; light.style.opacity = "0.5"; }
        else { light.style.opacity = "0.3"; }
      }
      let twx = 0, twy = 0;
      if (active) {
        twx = clamp(-7, 7, (mx - (rect.left + rect.width / 2)) / rect.width * 14);
        twy = clamp(-4, 4, (my - (rect.top + rect.height / 2)) / rect.height * 10);
      }
      wx += (twx - wx) * 0.06; wy += (twy - wy) * 0.06;
      if (word) word.setAttribute("transform", `translate(${wx.toFixed(2)} ${wy.toFixed(2)})`);
    });
  }

  /* ========================================================
     ASCII SHADER — the hero signature (cursor-reactive field)
     ======================================================== */
  function initAscii() {
    if (REDUCED || !window.EventicAscii) return;
    const canvas = document.getElementById("ascii");
    const heroEl = document.getElementById("hero");
    if (!canvas || !heroEl) return;
    const api = window.EventicAscii.start(canvas);
    window.__ascii = api;
    const io = new IntersectionObserver((es) => es.forEach((e) => api.setVisible(e.isIntersecting)), { threshold: 0.01 });
    io.observe(heroEl);
    heroEl.addEventListener("mousemove", (e) => api.setPointer(e.clientX, e.clientY, true));
    heroEl.addEventListener("mouseleave", () => api.leave());
    heroEl.addEventListener("click", (e) => api.pulse(e.clientX, e.clientY));
    if (window.gsap) gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 0.15, ease: "power2.out" });
  }

  /* ========================================================
     HORIZONTAL WORK GALLERY — pin + scrub (vertical → sideways)
     ======================================================== */
  function initGallery() {
    if (REDUCED || !window.gsap) return;
    const track = document.querySelector("[data-gallery] .gallery-track");
    if (!track) return;
    const gallery = track.closest("[data-gallery]");
    if (window.innerWidth < 760) { gallery.style.overflowX = "auto"; return; } // native scroll on small screens
    gsap.registerPlugin(ScrollTrigger);
    const dist = () => Math.max(0, track.scrollWidth - gallery.clientWidth);
    gsap.to(track, {
      x: () => -dist(), ease: "none",
      scrollTrigger: {
        trigger: gallery, pin: true, scrub: 1, invalidateOnRefresh: true,
        start: "top top", end: () => "+=" + dist(),
      },
    });
  }

  /* ========================================================
     CLOSING — on arrival, show "Let's build", then after a few
     seconds auto-swap to "Send-off" and stay (time-based, no scroll)
     ======================================================== */
  function initClosing() {
    const sec = document.querySelector("[data-closing]");
    if (!sec) return;
    let armed = false;
    const reveal = () => { armed = true; io.disconnect(); setTimeout(() => sec.classList.add("show-b"), 2600); };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting && !armed) reveal(); });
    }, { threshold: 0.6 });
    io.observe(sec);
  }

  /* ========================================================
     CONTACT FORM (backend-free → composes a mailto)
     ======================================================== */
  function initContactForm() {
    const form = document.querySelector("[data-mailto-form]");
    if (!form) return;
    // project-type chips (multi-select)
    const chips = form.querySelectorAll(".chip");
    chips.forEach((c) => c.addEventListener("click", () => {
      const on = c.getAttribute("aria-pressed") === "true";
      c.setAttribute("aria-pressed", on ? "false" : "true");
    }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const to = form.getAttribute("data-to") || "studio@eventic.design";
      const name = (form.querySelector('[name="name"]') || {}).value || "";
      const email = (form.querySelector('[name="email"]') || {}).value || "";
      const message = (form.querySelector('[name="message"]') || {}).value || "";
      const types = Array.from(chips).filter((c) => c.getAttribute("aria-pressed") === "true").map((c) => c.textContent.trim());
      const subject = `Project enquiry — ${name || "new"}${types.length ? " · " + types.join(", ") : ""}`;
      const body = [
        `Name: ${name}`,
        `Email: ${email}`,
        types.length ? `Interested in: ${types.join(", ")}` : "",
        "",
        message,
        "",
        "— sent from eventic.design",
      ].filter((l) => l !== null).join("\n");
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }

  /* ========================================================
     BOOT SEQUENCE
     ======================================================== */
  function boot() {
    initHeroWordmark();
    initAscii();
    initGallery();
    initClosing();
    initBalloon();
    initContactForm();
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => {
      buildMotion();
    });
  }
  // wait for fonts before measuring lines; preloader runs in parallel
  runPreloader(boot);
})();
