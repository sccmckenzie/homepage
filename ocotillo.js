// Grows an ocotillo on a <canvas> in place of the static .logo SVG.
// Same generator as ocotillo-generation/ocotillo.py, ported to JS.
(() => {
  const SEED = 7;
  const BASE = [100, 186];
  const STEMS = 15;              // main canes from the base
  const W0 = 4.2, W1 = 0.1;      // width at base, width at tips
  const SEG = 7;                 // segment length
  const BRANCH_P = 0.25;         // chance a cane forks
  const WOBBLE = 0.04, ASKEW = 0.7;  // angle jitter near base vs. near tips
  const DURATION = 2800;         // ms for the whole plant to grow
  const FRONT = 8;               // length of the thin taper at a growing tip

  // seeded PRNG (mulberry32) so every visit grows the same plant
  let s = SEED >>> 0;
  const random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const uniform = (a, b) => a + (b - a) * random();
  const gauss = (mu, sigma) =>
    mu + sigma * Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());

  // each stem: points, widths, cumulative lengths, and `offset` = distance from
  // the root to where it starts, so branches begin when their parent reaches them
  const stems = [];

  function grow(x, y, ang, length, wStart, depth, offset) {
    const n = Math.max(3, Math.round(length / SEG));
    const pts = [[x, y]], ws = [wStart], forks = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      ang += gauss(0, WOBBLE + ASKEW * t ** 3);
      x += Math.sin(ang) * SEG;
      y -= Math.cos(ang) * SEG;
      pts.push([x, y]);
      ws.push(wStart + (W1 - wStart) * t);
      if (depth < 2 && t > 0.3 && t < 0.75 && !forks.length && random() < BRANCH_P / (n * 0.45))
        forks.push([x, y, ang, length * (1 - t), ws[ws.length - 1], offset + i * SEG]);
    }
    stems.push({ pts, ws, offset });
    for (const [fx, fy, fa, rem, fw, fo] of forks) {
      const sides = random() < 0.5 ? [-1, 1] : [1, -1];
      for (const side of sides.slice(0, random() < 0.5 ? 1 : 2))
        grow(fx, fy, fa + side * uniform(0.3, 0.65), rem * uniform(0.8, 1.15), fw, depth + 1, fo);
    }
  }

  for (let k = 0; k < STEMS; k++) {
    const spread = (k / (STEMS - 1) - 0.5) * 2;   // -1 .. 1
    const ang = spread * 0.7 + gauss(0, 0.06);
    const length = uniform(165, 215) * (1 - 0.3 * Math.abs(spread));
    const bx = BASE[0] + uniform(-4, 4);
    grow(bx, BASE[1], ang, length, W0 * uniform(0.8, 1.05), 0, uniform(0, 12));
  }

  // fit everything inside the 200x200 box, scaling about the base
  const all = stems.flatMap(st => st.pts);
  const M = 6;
  const sc = Math.min(1,
    (BASE[1] - M) / (BASE[1] - Math.min(...all.map(p => p[1]))),
    (BASE[0] - M) / Math.max(1e-9, BASE[0] - Math.min(...all.map(p => p[0]))),
    (200 - M - BASE[0]) / Math.max(1e-9, Math.max(...all.map(p => p[0])) - BASE[0]));
  for (const st of stems) {
    st.pts = st.pts.map(([x, y]) => [BASE[0] + (x - BASE[0]) * sc, BASE[1] + (y - BASE[1]) * sc]);
    st.ws = st.ws.map(w => w * Math.sqrt(sc));
    st.offset *= sc;
    st.len = (st.pts.length - 1) * SEG * sc;
  }
  const total = Math.max(...stems.map(st => st.offset + st.len));

  // ground texture around the root: specks of grit plus a few short dashes.
  // Generated after the plant so it doesn't change the plant's random sequence.
  const GRIT = 140, DASHES = 22;
  const grit = [], dashes = [];
  for (let i = 0; i < GRIT; i++) {
    const x = BASE[0] + gauss(0, 20);
    const y = Math.min(198, BASE[1] + Math.abs(gauss(0, 3.5)) - 0.5);
    const r = uniform(0.4, 1.3) * Math.max(0.35, 1 - Math.abs(x - BASE[0]) / 60);
    grit.push([x, y, r]);
  }
  for (let i = 0; i < DASHES; i++) {
    const x = BASE[0] + gauss(0, 24);
    const y = Math.min(197, BASE[1] + 0.5 + Math.abs(gauss(0, 3.5)));
    const len = uniform(3, 8) * Math.max(0.4, 1 - Math.abs(x - BASE[0]) / 70);
    const a = gauss(0, 0.08);
    dashes.push([x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2,
                 x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2]);
  }

  function drawGround(ctx) {
    ctx.beginPath();
    for (const [x, y, r] of grit) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, 2 * Math.PI);
    }
    ctx.fill();
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of dashes) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.lineWidth = 0.8;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // the visible part of a stem, `vis` units long, with its tip tapered to W1
  function partial(st, vis) {
    const step = SEG * sc;
    const pts = [], ws = [];
    for (let i = 0; i < st.pts.length; i++) {
      const d = i * step;
      if (d >= vis) {
        const [ax, ay] = st.pts[i - 1], [bx, by] = st.pts[i];
        const f = (vis - (d - step)) / step;
        pts.push([ax + (bx - ax) * f, ay + (by - ay) * f]);
        ws.push(st.ws[i - 1] + (st.ws[i] - st.ws[i - 1]) * f);
        break;
      }
      pts.push(st.pts[i]);
      ws.push(st.ws[i]);
    }
    const dists = pts.map((_, i) => Math.min(i * step, vis));
    return { pts, ws: ws.map((w, i) => W1 + (w - W1) * Math.min(1, (vis - dists[i]) / FRONT)) };
  }

  function outline(ctx, pts, ws) {
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      let dx = 0, dy = 0;
      for (const [ax, ay, bx, by] of [
        i > 0 ? [...pts[i - 1], x, y] : null,
        i < pts.length - 1 ? [x, y, ...pts[i + 1]] : null,
      ].filter(Boolean)) {
        const h = Math.hypot(bx - ax, by - ay) || 1;
        dx += (bx - ax) / h;
        dy += (by - ay) / h;
      }
      const n = Math.hypot(dx, dy) || 1, hw = ws[i] / 2;
      left.push([x - dy / n * hw, y + dx / n * hw]);
      right.push([x + dy / n * hw, y - dx / n * hw]);
    }
    const ring = [...left, pts[pts.length - 1], ...right.reverse()];
    ctx.moveTo(...ring[0]);
    for (const p of ring.slice(1)) ctx.lineTo(...p);
    ctx.closePath();
  }

  const logo = document.querySelector(".logo");
  if (!logo) return;
  const canvas = document.createElement("canvas");
  canvas.className = logo.className;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", logo.getAttribute("aria-label") || "Ocotillo");
  canvas.style.mask = canvas.style.webkitMask = "none";
  canvas.style.background = "none";
  logo.replaceWith(canvas);
  const ctx = canvas.getContext("2d");

  let progress = 0;

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    if (canvas.width !== Math.round(size * dpr)) {
      canvas.width = canvas.height = Math.round(size * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * size / 200, 0, 0, dpr * size / 200, 0, 0);
    const color = getComputedStyle(canvas).color;
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.globalAlpha = Math.min(1, progress * 5);   // ground fades in as growth starts
    drawGround(ctx);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.5;
    ctx.lineJoin = "round";
    const reach = progress * total;
    ctx.beginPath();
    for (const st of stems) {
      const vis = Math.min(st.len, reach - st.offset);
      if (vis <= 0) continue;
      const { pts, ws } = partial(st, vis);
      outline(ctx, pts, ws);
    }
    ctx.fill("nonzero");
    ctx.stroke();
  }

  const easeOut = t => 1 - (1 - t) ** 3;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    progress = 1;
    draw();
  } else {
    const start = performance.now();
    const frame = now => {
      progress = easeOut(Math.min(1, (now - start) / DURATION));
      draw();
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  new ResizeObserver(draw).observe(canvas);
})();
