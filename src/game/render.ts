import { COLORS, DANGER_Y, LOGICAL_H, LOGICAL_W, R, SHOOTER_Y, TOP_Y } from "./constants";
import { BubbleEngine, cellX, cellY } from "./engine";
import type { Special } from "./types";

const STARS = Array.from({ length: 110 }, (_, i) => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  const f = s - Math.floor(s);
  const s2 = Math.sin(i * 78.233) * 43758.5453;
  const f2 = s2 - Math.floor(s2);
  return { x: f * LOGICAL_W, y: f2 * LOGICAL_H, r: 0.5 + ((i * 7) % 5) * 0.35, ph: (i * 1.7) % 6.28, layer: i % 3 };
});

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

export function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colorIdx: number, special?: Special, t = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const base = colorIdx < 0 ? "#8e98a8" : COLORS[colorIdx];
  if (special === "rainbow") {
    const g = ctx.createConicGradient ? ctx.createConicGradient(t * 2, x, y) : null;
    if (g) {
      COLORS.forEach((c, i) => g.addColorStop(i / COLORS.length, c));
      g.addColorStop(1, COLORS[0]);
      ctx.fillStyle = g;
    } else ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, shade(base, 70));
    g.addColorStop(0.55, base);
    g.addColorStop(1, shade(base, -60));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // gloss
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.42, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
  ctx.stroke();

  if (special === "stone") {
    ctx.strokeStyle = "rgba(30,35,45,0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.1);
    ctx.lineTo(x - r * 0.1, y + r * 0.15);
    ctx.lineTo(x + r * 0.2, y - r * 0.2);
    ctx.lineTo(x + r * 0.5, y + r * 0.3);
    ctx.stroke();
  } else if (special === "bomb") {
    ctx.fillStyle = "rgba(20,20,30,0.85)";
    ctx.beginPath();
    ctx.arc(x, y + 1, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd60a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.2, y - r * 0.35);
    ctx.quadraticCurveTo(x + r * 0.5, y - r * 0.7, x + r * 0.35, y - r * 0.85);
    ctx.stroke();
    const sp = 0.5 + 0.5 * Math.sin(t * 20);
    ctx.fillStyle = `rgba(255,${160 + sp * 90},40,${0.6 + sp * 0.4})`;
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y - r * 0.85, 2.5 + sp * 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (special === "lightning") {
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.15, y - r * 0.6);
    ctx.lineTo(x - r * 0.3, y + r * 0.05);
    ctx.lineTo(x, y + r * 0.05);
    ctx.lineTo(x - r * 0.15, y + r * 0.6);
    ctx.lineTo(x + r * 0.3, y - r * 0.05);
    ctx.lineTo(x, y - r * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, e: BubbleEngine, t: number) {
  const W = LOGICAL_W, H = LOGICAL_H;
  ctx.save();
  if (e.shake > 0) {
    const k = e.shake * 6;
    ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
  }

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, e.fever ? "#2a0f4a" : "#0b1030");
  bg.addColorStop(0.6, e.fever ? "#3a1252" : "#151a4a");
  bg.addColorStop(1, "#070a1f");
  ctx.fillStyle = bg;
  ctx.fillRect(-10, -10, W + 20, H + 20);
  // nebula
  const neb = ctx.createRadialGradient(W * 0.8, H * 0.7, 10, W * 0.8, H * 0.7, 320);
  neb.addColorStop(0, e.fever ? "rgba(255,80,160,0.35)" : "rgba(120,60,220,0.28)");
  neb.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, W, H);
  const neb2 = ctx.createRadialGradient(W * 0.15, H * 0.35, 10, W * 0.15, H * 0.35, 260);
  neb2.addColorStop(0, "rgba(40,180,220,0.18)");
  neb2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, W, H);
  // stars
  for (const s of STARS) {
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + s.layer) + s.ph);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.6})`;
    const yy = (s.y + t * (4 + s.layer * 6)) % H;
    ctx.beginPath();
    ctx.arc(s.x, yy, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ceiling bar
  const cg = ctx.createLinearGradient(0, TOP_Y - 14, 0, TOP_Y);
  cg.addColorStop(0, "rgba(140,160,255,0.35)");
  cg.addColorStop(1, "rgba(140,160,255,0.05)");
  ctx.fillStyle = cg;
  ctx.fillRect(0, TOP_Y - 14, W, 14);

  // danger line
  const d = e.danger;
  const pulse = 0.5 + 0.5 * Math.sin(t * (d > 0.75 ? 10 : 3));
  ctx.setLineDash([8, 8]);
  ctx.lineDashOffset = -t * 30;
  ctx.strokeStyle = d > 0.75 ? `rgba(255,60,90,${0.5 + pulse * 0.5})` : `rgba(255,255,255,${0.18 + pulse * 0.1})`;
  ctx.lineWidth = d > 0.75 ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.moveTo(0, DANGER_Y);
  ctx.lineTo(W, DANGER_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (d > 0.75) {
    const dg = ctx.createLinearGradient(0, DANGER_Y - 60, 0, DANGER_Y);
    dg.addColorStop(0, "rgba(255,60,90,0)");
    dg.addColorStop(1, `rgba(255,60,90,${0.12 + pulse * 0.15})`);
    ctx.fillStyle = dg;
    ctx.fillRect(0, DANGER_Y - 60, W, 60);
  }

  // grid
  const introK = e.status === "intro" ? Math.min(1, e.introT / 0.6) : 1;
  for (const b of e.grid.values()) {
    let x = cellX(b.row, b.col, e.parity);
    let y = cellY(b.row) + e.dropAnim;
    if (introK < 1) {
      const delay = b.row * 0.06;
      const k = Math.max(0, Math.min(1, (e.introT - delay) / 0.35));
      const ease = 1 - Math.pow(1 - k, 3);
      y = y - (1 - ease) * 120;
      if (k === 0) continue;
    }
    if (b.wobble && b.wobble > 0) {
      b.wobble -= 1 / 60;
      x += Math.sin(b.wobble * 40) * b.wobble * 8;
    }
    drawBubble(ctx, x, y, R - 1, b.color, b.special, t);
  }

  // falling
  for (const f of e.falling) {
    drawBubble(ctx, f.x, f.y, R - 1, f.color, f.special, t, Math.max(0.2, 1 - f.life * 0.6));
  }

  // aim guide
  if (e.status === "ready" || e.status === "intro") {
    const laser = e.laserShots > 0;
    ctx.save();
    ctx.strokeStyle = laser ? "rgba(255,90,90,0.9)" : "rgba(255,255,255,0.55)";
    ctx.lineWidth = laser ? 2.5 : 2;
    ctx.setLineDash(laser ? [] : [4, 10]);
    ctx.lineDashOffset = -t * 60;
    if (laser) {
      ctx.shadowColor = "#ff5a5a";
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    e.guide.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
    if (laser && e.guideCell) {
      const gx = cellX(e.guideCell.row, e.guideCell.col, e.parity);
      const gy = cellY(e.guideCell.row);
      ctx.save();
      ctx.globalAlpha = 0.45;
      drawBubble(ctx, gx, gy, R - 2, e.current.color, e.current.special, t, 0.45);
      ctx.restore();
    }
  }

  // shooter
  const sx = W / 2, sy = SHOOTER_Y;
  ctx.save();
  const baseG = ctx.createRadialGradient(sx, sy + 8, 4, sx, sy + 8, R * 2.4);
  baseG.addColorStop(0, "rgba(140,160,255,0.35)");
  baseG.addColorStop(1, "rgba(140,160,255,0)");
  ctx.fillStyle = baseG;
  ctx.beginPath();
  ctx.arc(sx, sy + 8, R * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sx, sy, R + 9, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();

  // projectile / current bubble
  if (e.projectile) {
    e.trail.forEach((p, i) => {
      const k = (i + 1) / e.trail.length;
      ctx.globalAlpha = k * 0.35;
      ctx.fillStyle = COLORS[e.projectile!.color];
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * k * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    drawBubble(ctx, e.projectile.x, e.projectile.y, R - 1, e.projectile.color, e.projectile.special, t);
  } else if (e.status !== "won" && e.status !== "lost") {
    drawBubble(ctx, sx, sy, R - 1, e.current.color, e.current.special, t);
  }
  // next bubble
  if (e.status !== "won" && e.status !== "lost") {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(sx + 62, sy + 22, R * 0.85 + 6, 0, Math.PI * 2);
    ctx.fill();
    drawBubble(ctx, sx + 62, sy + 22, R * 0.7, e.next.color, undefined, t);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NEXT", sx + 62, sy + 50);
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillText("⇄", sx - 62, sy + 27);
    ctx.restore();
  }

  // particles
  for (const q of e.particles) {
    const k = q.life / q.maxLife;
    ctx.globalAlpha = Math.max(0, Math.min(1, k));
    if (q.kind === 2) {
      ctx.strokeStyle = q.color;
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * (1 + (1 - k) * 1.6), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = q.kind === 1 ? "#ffffff" : q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // popups
  for (const u of e.popups) {
    const k = u.life / u.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.5);
    ctx.translate(u.x, u.y);
    const sc = u.scale * (1 + (1 - k) * 0.25);
    ctx.scale(sc, sc);
    ctx.font = "800 18px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.strokeText(u.text, 0, 0);
    ctx.fillStyle = u.color;
    ctx.fillText(u.text, 0, 0);
    ctx.restore();
  }

  // fever overlay
  if (e.fever) {
    const k = 0.5 + 0.5 * Math.sin(t * 8);
    const fg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    fg.addColorStop(0, "rgba(255,80,160,0)");
    fg.addColorStop(1, `rgba(255,80,160,${0.15 + k * 0.15})`);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, W, H);
  }
  if (e.flashT > 0 && e.flashColor) {
    ctx.globalAlpha = (e.flashT / 0.25) * 0.35;
    ctx.fillStyle = e.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
