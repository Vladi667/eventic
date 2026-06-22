/* ============================================================
   EVENTIC — ASCII shader
   A flowing interference field rendered as monospace characters.
   Cursor warps the field + leaves a lime "bloom"; click ripples;
   scramble-resolves on load. Row-batched fillText = 60fps.
   ============================================================ */
window.EventicAscii = (function () {
  "use strict";
  const RAMP = " .:-=+*#%@";              // 10 density levels (index 0 = blank)

  function start(canvas) {
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, cols = 0, rows = 0, cw = 9, ch = 16, fontPx = 15;
    let t = 0, raf = 0, visible = true;
    let mcol = -999, mrow = -999, active = false, warp = 0;
    let reveal = 0;                         // 0..1 scramble-resolve on load
    const ripple = { x: 0, y: 0, r: 0, on: false };

    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fontPx = W < 680 ? 12 : 15;
      ctx.font = fontPx + 'px ui-monospace, "SF Mono", Menlo, monospace';
      cw = ctx.measureText("0").width || fontPx * 0.6;
      ch = Math.round(fontPx * 1.12);
      cols = Math.ceil(W / cw) + 1;
      rows = Math.ceil(H / ch) + 1;
    }
    resize();
    window.addEventListener("resize", resize);

    function field(c, r) {
      const x = c - cols / 2, y = r - rows / 2;
      let v = Math.sin(x * 0.16 + t * 0.7)
            + Math.sin(y * 0.14 - t * 0.5)
            + Math.sin((x + y) * 0.09 + t * 0.9)
            + Math.sin(Math.hypot(x, y) * 0.13 - t * 1.1);
      v *= 0.25;                            // -1..1
      if (warp > 0.001) {
        const dx = c - mcol, dy = r - mrow;
        v += Math.exp(-(dx * dx + dy * dy) / 162) * warp;   // bloom, ~9-cell radius
      }
      if (ripple.on) {
        const d = Math.hypot(c - ripple.x, r - ripple.y);
        v += Math.exp(-((d - ripple.r) * (d - ripple.r)) / 18) * 0.9;
      }
      return v;
    }
    function glyph(v) {
      let n = (v + 1) * 0.5;        // 0..1
      n = n * n;                    // contrast curve → more blank space, dense only at ridges
      let i = (n * (RAMP.length - 1)) | 0;
      return RAMP[i < 0 ? 0 : i > RAMP.length - 1 ? RAMP.length - 1 : i];
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      t += 0.02;
      warp += ((active ? 0.85 : 0) - warp) * 0.08;
      if (reveal < 1) reveal = Math.min(1, reveal + 0.012);
      if (ripple.on) { ripple.r += 1.1; if (ripple.r > Math.max(cols, rows)) ripple.on = false; }

      ctx.clearRect(0, 0, W, H);
      ctx.font = fontPx + 'px ui-monospace, "SF Mono", Menlo, monospace';
      ctx.textBaseline = "top";
      const dark = document.documentElement.getAttribute("data-theme") === "dark";

      // base field — one fillText per row
      ctx.fillStyle = (dark ? "rgba(150,160,150," : "rgba(120,126,121,") + (0.5 * reveal).toFixed(3) + ")";
      for (let r = 0; r < rows; r++) {
        let line = "";
        const scram = reveal < 1;
        for (let c = 0; c < cols; c++) {
          line += (scram && Math.random() > reveal) ? RAMP[(Math.random() * RAMP.length) | 0] : glyph(field(c, r));
        }
        ctx.fillText(line, 0, r * ch);
      }

      // accent bloom near the cursor (small region only)
      if (active && warp > 0.05) {
        ctx.fillStyle = (dark ? "rgba(212,255,61," : "rgba(133,168,0,") + (0.85 * reveal).toFixed(3) + ")";
        const r0 = Math.max(0, (mrow - 8) | 0), r1 = Math.min(rows - 1, (mrow + 8) | 0);
        const c0 = Math.max(0, (mcol - 10) | 0), c1 = Math.min(cols - 1, (mcol + 10) | 0);
        for (let r = r0; r <= r1; r++) {
          let seg = "";
          for (let c = c0; c <= c1; c++) {
            const dx = c - mcol, dy = r - mrow;
            seg += (dx * dx + dy * dy > 100) ? " " : glyph(field(c, r));
          }
          ctx.fillText(seg, c0 * cw, r * ch);
        }
      }
    }
    frame();

    return {
      setPointer(clientX, clientY, isActive) {
        const rect = canvas.getBoundingClientRect();
        mcol = (clientX - rect.left) / cw;
        mrow = (clientY - rect.top) / ch;
        active = isActive !== false;
      },
      leave() { active = false; },
      pulse(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        ripple.x = (clientX - rect.left) / cw;
        ripple.y = (clientY - rect.top) / ch;
        ripple.r = 0; ripple.on = true;
      },
      setVisible(v) { visible = v; },
      resize,
      destroy() { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); },
    };
  }
  return { start };
})();
