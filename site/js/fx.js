/* Woodhouse Grill — canvas motion FX: embers, smoke, flakes */
(function () {
  // soft particles don't need retina resolution — keeps fill-rate low
  const DPR = () => 1;
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class CanvasFX {
    constructor(canvas, opts = {}) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.o = opts; this.running = false; this.visible = true; this.t = 0;
      this.resize = this.resize.bind(this); this.loop = this.loop.bind(this);
      window.addEventListener('resize', this.resize); this.resize();
      document.addEventListener('visibilitychange', () => { if (!document.hidden && this.running) this.kick(); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible && this.running) this.kick(); }, { rootMargin: '100px' }).observe(canvas);
      }
    }
    resize() {
      const r = this.c.getBoundingClientRect(); const d = DPR();
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.c.width = Math.round(this.w * d); this.c.height = Math.round(this.h * d);
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
      this.onResize && this.onResize();
    }
    start() { if (this.running) return this; this.running = true; this.kick(); return this; }
    stop() { this.running = false; }
    kick() { if (!this.raf && !document.hidden) this.raf = requestAnimationFrame(this.loop); }
    loop(ts) {
      this.raf = null;
      if (!this.running || !this.visible || document.hidden) { this.last = 0; return; }
      const dt = Math.min(0.05, this.last ? (ts - this.last) / 1000 : 0.016); this.last = ts; this.t += dt;
      this.step(dt); this.kick();
    }
  }

  /* ---------- Rising embers / sparks ---------- */
  class Embers extends CanvasFX {
    constructor(canvas, opts) {
      super(canvas, Object.assign({ count: 70, speed: 1, spread: 1, wind: 0.0, size: 1, origin: 'bottom', glow: true }, opts));
      this.p = []; for (let i = 0; i < this.o.count; i++) this.p.push(this.spawn(true));
      this.burstP = [];
    }
    spawn(initial) {
      const o = this.o;
      const x = o.originX != null ? this.w * o.originX + rand(-this.w * 0.18, this.w * 0.18) * o.spread : rand(0, this.w);
      return {
        x, y: initial ? rand(0, this.h) : this.h + rand(0, 40),
        vx: rand(-12, 12), vy: -rand(30, 95) * o.speed,
        r: rand(0.5, 2.2) * o.size, life: 0, max: rand(2.5, 6.5),
        ph: rand(0, Math.PI * 2), fl: rand(4, 11), hue: rand(14, 42)
      };
    }
    burst(x, y, n = 60, power = 1) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), s = rand(80, 420) * power;
        this.burstP.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, r: rand(0.6, 2.4), life: 0, max: rand(0.6, 1.6), hue: rand(18, 48) });
      }
    }
    draw(q, alpha) {
      const ctx = this.ctx;
      const light = 55 + (q.hue - 14) * 1.1;
      ctx.fillStyle = `hsla(${q.hue},100%,${light}%,${alpha})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill();
      if (this.o.glow && q.r > 1.1) {
        ctx.fillStyle = `hsla(${q.hue - 6},100%,50%,${alpha * 0.18})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r * 4, 0, 6.283); ctx.fill();
      }
    }
    step(dt) {
      const ctx = this.ctx; ctx.clearRect(0, 0, this.w, this.h);
      ctx.globalCompositeOperation = 'lighter';
      const t = this.t, wind = this.o.wind + (this.pointerX || 0) * 18;
      for (let i = 0; i < this.p.length; i++) {
        const q = this.p[i];
        q.life += dt;
        q.vx += (Math.sin(t * 1.3 + q.ph) * 26 + wind) * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.vx *= 0.985;
        const k = q.life / q.max;
        if (k >= 1 || q.y < -20) { this.p[i] = this.spawn(false); continue; }
        const flick = 0.65 + 0.35 * Math.sin(t * q.fl + q.ph);
        const fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        this.draw(q, Math.max(0, fade * flick));
      }
      for (let i = this.burstP.length - 1; i >= 0; i--) {
        const q = this.burstP[i]; q.life += dt;
        q.vx *= 0.94; q.vy = q.vy * 0.94 - 30 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        const k = q.life / q.max; if (k >= 1) { this.burstP.splice(i, 1); continue; }
        this.draw(q, 1 - k);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* ---------- Drifting smoke ---------- */
  class Smoke extends CanvasFX {
    constructor(canvas, opts) {
      super(canvas, Object.assign({ count: 16, tint: '180,170,160', alpha: 0.07 }, opts));
      const s = document.createElement('canvas'); s.width = s.height = 256; const g = s.getContext('2d');
      const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, `rgba(${this.o.tint},1)`); grd.addColorStop(0.4, `rgba(${this.o.tint},.45)`); grd.addColorStop(1, `rgba(${this.o.tint},0)`);
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256); this.sprite = s;
      this.p = []; for (let i = 0; i < this.o.count; i++) this.p.push(this.spawn(true));
    }
    spawn(initial) {
      return { x: rand(-0.1, 1.1) * this.w, y: initial ? rand(0.2, 1.1) * this.h : this.h + rand(50, 200), s: rand(220, 520), vx: rand(-8, 14), vy: -rand(10, 26), a: rand(0, 6.28), va: rand(-0.12, 0.12), al: rand(0.5, 1) };
    }
    step(dt) {
      const ctx = this.ctx; ctx.clearRect(0, 0, this.w, this.h);
      for (let i = 0; i < this.p.length; i++) {
        const q = this.p[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.a += q.va * dt; q.s += 8 * dt;
        if (q.y < -q.s) { this.p[i] = this.spawn(false); continue; }
        const fy = Math.min(1, Math.max(0, q.y / this.h));
        ctx.globalAlpha = this.o.alpha * q.al * (0.3 + 0.7 * fy);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a);
        ctx.drawImage(this.sprite, -q.s / 2, -q.s / 2, q.s, q.s); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- Gold-leaf & char flakes (for parchment sections) ---------- */
  class Flakes extends CanvasFX {
    constructor(canvas, opts) {
      super(canvas, Object.assign({ count: 46 }, opts));
      this.p = []; for (let i = 0; i < this.o.count; i++) this.p.push(this.spawn(true));
      this.scrollV = 0;
    }
    spawn(initial) {
      const gold = Math.random() < 0.62;
      const pts = []; const n = 5 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + rand(-0.3, 0.3); const r = rand(0.45, 1); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      return {
        x: rand(0, this.w), y: initial ? rand(0, this.h) : -20, z: rand(0.4, 1.6),
        s: rand(3, 11), rot: rand(0, 6.28), vr: rand(-1.6, 1.6), flip: rand(0, 6.28), vf: rand(1, 3.5),
        vy: rand(10, 32), ph: rand(0, 6.28), gold, pts,
        col: gold ? `hsl(${rand(36, 46)},${rand(70, 90)}%,${rand(48, 64)}%)` : `hsl(${rand(15, 25)},${rand(30, 50)}%,${rand(10, 20)}%)`
      };
    }
    step(dt) {
      const ctx = this.ctx; ctx.clearRect(0, 0, this.w, this.h);
      const sv = this.scrollV; this.scrollV *= 0.92;
      for (let i = 0; i < this.p.length; i++) {
        const q = this.p[i];
        q.y += (q.vy * q.z + sv * q.z * 0.6) * dt;
        q.x += (Math.sin(this.t * 0.8 + q.ph) * 14 * q.z - sv * 0.2 * q.z) * dt;
        q.rot += q.vr * dt; q.flip += q.vf * dt;
        if (q.y > this.h + 30) { this.p[i] = this.spawn(false); continue; }
        if (q.y < -40) q.y = this.h + 20;
        if (q.x < -30) q.x = this.w + 20; if (q.x > this.w + 30) q.x = -20;
        const sx = Math.cos(q.flip);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(sx * q.s * q.z, q.s * q.z);
        ctx.beginPath(); q.pts.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
        ctx.fillStyle = q.col; ctx.globalAlpha = q.gold ? 0.55 + 0.45 * Math.abs(sx) : 0.75;
        ctx.fill();
        if (q.gold && Math.abs(sx) > 0.85) { ctx.fillStyle = 'rgba(255,250,220,.7)'; ctx.globalAlpha = (Math.abs(sx) - 0.85) * 5; ctx.fill(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  window.FX = { Embers, Smoke, Flakes, reduce };
})();
