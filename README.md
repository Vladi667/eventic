# Eventic

Marketing site for **Eventic** — a design studio for events. *Design with purpose, clarity, and impact.*

A static, no-build site: plain HTML/CSS/JS. Apple-keynote / minimal editorial direction, all Schibsted Grotesk, one signal-lime accent, light base with a "lights off" dark mode.

## Highlights
- Editorial hero with a cursor-reactive **ASCII shader** field
- Custom cursor, magnetic buttons, ink page transitions
- GSAP + ScrollTrigger reveals, horizontal pin-scrub Work gallery, Lenis smooth scroll
- OKLCH color system, reduced-motion + no-WebGL fallbacks
- Pages: Home · Services · Work · About · Contact (+ styled 404)

## Run locally
```bash
python -m http.server 8077
# open http://localhost:8077
```

## Stack
Vanilla HTML/CSS/JS · GSAP · Lenis · zero backend (contact form composes a mailto). Deployed as a static site on Vercel.
