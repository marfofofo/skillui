// La sfera: colori fluidi che si muovono dentro un cerchio di vetro, disegnati su canvas.
// Ogni stato (in attesa, ascolto, lavoro, voce, conferma) ha il suo carattere.

export function createOrb(canvas, initialTheme) {
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Monocromatica: una perla d'argento sul nero, una perla di grafite sul bianco.
  const PALETTE = {
    dark: {
      base: [28, 28, 28],
      blobs: [[255, 255, 255], [140, 140, 140], [70, 70, 70], [210, 210, 210]],
      rim: [255, 255, 255],
    },
    light: {
      base: [14, 14, 14],
      blobs: [[150, 150, 150], [60, 60, 60], [225, 225, 225], [100, 100, 100]],
      rim: [0, 0, 0],
    },
  };

  // Carattere di ogni stato: dimensione, velocità, intensità dei colori, alone, saturazione.
  const MOODS = {
    offline:   { scale: 0.82, speed: 0.25, glow: 0.0,  intensity: 0.35, color: 0 },
    idle:      { scale: 0.92, speed: 0.45, glow: 0.35, intensity: 0.8,  color: 1 },
    listening: { scale: 1.06, speed: 1.4,  glow: 0.9,  intensity: 1.0,  color: 1 },
    thinking:  { scale: 0.86, speed: 2.4,  glow: 0.45, intensity: 0.75, color: 1 },
    speaking:  { scale: 0.98, speed: 1.0,  glow: 0.7,  intensity: 0.95, color: 1 },
    approval:  { scale: 0.88, speed: 0.4,  glow: 0.2,  intensity: 0.5,  color: 0.6 },
  };

  let theme = initialTheme;
  let mood = "offline";
  const cur = { ...MOODS.offline };
  let energy = 0;
  let t = 0;
  let last = performance.now();
  let w = 0;
  let h = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  resize();

  const lerp = (a, b, k) => a + (b - a) * k;
  const gray = (c, amount) => {
    const g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    return c.map((v) => lerp(g, v, amount));
  };
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = 1 - Math.pow(0.015, dt);
    const target = MOODS[mood];
    for (const key in cur) cur[key] = lerp(cur[key], target[key], k);
    energy *= Math.pow(0.1, dt);
    t += dt * (reduced ? 0.1 : cur.speed + energy * 1.5);

    const pal = PALETTE[theme];
    const cx = w / 2;
    const cy = h / 2;
    const base = Math.min(w, h) / 2 / 1.6; // il canvas è il 160% del pulsante
    const pulse = mood === "speaking" ? Math.sin(t * 5) * 0.03 + Math.sin(t * 1.7) * 0.02 : Math.sin(t * 1.2) * 0.012;
    const R = base * (cur.scale + pulse + energy * 0.08);

    ctx.clearRect(0, 0, w, h);

    // Alone colorato
    if (cur.glow > 0.01) {
      const g = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.65);
      g.addColorStop(0, rgba(gray(pal.blobs[1], cur.color), 0.45 * cur.glow));
      g.addColorStop(1, rgba(pal.blobs[1], 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // Corpo della sfera
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = rgba(gray(pal.base, cur.color), 1);
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    ctx.globalCompositeOperation = "screen";
    pal.blobs.forEach((c, i) => {
      const p = i * 1.9;
      const bx = cx + Math.sin(t * (0.9 + i * 0.23) + p) * R * 0.48;
      const by = cy + Math.cos(t * (0.7 + i * 0.31) + p * 1.3) * R * 0.48;
      const br = R * (0.62 + 0.14 * Math.sin(t * 0.8 + i));
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, rgba(gray(c, cur.color), cur.intensity));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    });
    ctx.globalCompositeOperation = "source-over";

    // Profondità: bordo più scuro e riflesso in alto, come una biglia di vetro
    const shade = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,.16)");
    ctx.fillStyle = shade;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    const hl = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.55, 0, cx - R * 0.25, cy - R * 0.55, R * 0.75);
    hl.addColorStop(0, "rgba(255,255,255,.35)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(pal.rim, 0.22);
    ctx.lineWidth = 1;
    ctx.stroke();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setState(s) { mood = MOODS[s] ? s : "idle"; },
    setTheme(th) { theme = th; },
    kick() { energy = Math.min(1, energy + 0.5); },
  };
}
