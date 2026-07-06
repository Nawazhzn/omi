import * as THREE from "three";
import type { Rank, Suit } from "@omi/engine";

const SUIT_GLYPH: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_NAME: Record<Suit, string> = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
const RED = new Set<Suit>(["H", "D"]);

/** A font stack that reliably carries the ♠♥♦♣ glyphs across platforms. */
const GLYPH_FONT = '"Segoe UI Symbol", "Noto Sans Symbols2", "Noto Sans Symbols", "Apple Symbols", serif';

export function suitGlyph(s: Suit): string {
  return SUIT_GLYPH[s];
}
export function suitName(s: Suit): string {
  return SUIT_NAME[s];
}
/** Suit ink color as a CSS string — deep casino red for hearts/diamonds, near-black for spades/clubs. */
export function suitInk(s: Suit): string {
  return RED.has(s) ? "#c62a46" : "#161310";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A gold medallion face carrying the trump suit glyph — mapped onto both flat faces of the reveal coin. */
export function makeMedallionTexture(suit: Suit): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy * 0.82, size * 0.08, cx, cy, size * 0.5);
  grad.addColorStop(0, "#12523a");
  grad.addColorStop(1, "#05160e");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = size * 0.032;
  ctx.strokeStyle = "#e3bd5d";
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.455, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = size * 0.008;
  ctx.strokeStyle = "rgba(243,215,138,0.55)";
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.40, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = suitInk(suit);
  ctx.font = `bold ${size * 0.5}px ${GLYPH_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = size * 0.04;
  ctx.fillText(suitGlyph(suit), cx, cy + size * 0.02);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Manga-style radial speed lines converging on the centre, on a transparent
    field — used as a dramatic anime backdrop behind the 3D flourishes. */
export function makeSpeedLinesTexture(color: string, lines = 64): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const r0 = size * 0.17;
  const r1 = size * 0.72;
  for (let i = 0; i < lines; i++) {
    const a = (i / lines) * Math.PI * 2 + (i % 2) * 0.02;
    const w = 0.006 + (i % 3) * 0.005;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0);
    ctx.lineTo(cx + Math.cos(a - w) * r1, cy + Math.sin(a - w) * r1);
    ctx.lineTo(cx + Math.cos(a + w) * r1, cy + Math.sin(a + w) * r1);
    ctx.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0);
    ctx.closePath();
    const grad = ctx.createLinearGradient(
      cx + Math.cos(a) * r0,
      cy + Math.sin(a) * r0,
      cx + Math.cos(a) * r1,
      cy + Math.sin(a) * r1
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A soft radial glow disc (bright centre → transparent edge) for flash bursts. */
export function makeGlowTexture(inner: string): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.5, inner.replace(/[\d.]+\)$/, "0.35)"));
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A full playing-card face (ivory stock, gold edge, corner indices, big center glyph) for the sword-cut card. */
export function makeCardTexture(rank: Rank, suit: Suit): THREE.CanvasTexture {
  const w = 512;
  const h = 716;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const ink = suitInk(suit);
  const glyph = suitGlyph(suit);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#fdfaf1");
  bg.addColorStop(1, "#f2e9d0");
  ctx.fillStyle = bg;
  roundRect(ctx, 6, 6, w - 12, h - 12, 40);
  ctx.fill();

  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(201,154,52,0.55)";
  roundRect(ctx, 12, 12, w - 24, h - 24, 34);
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const drawIndex = (x: number, y: number, flip: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.rotate(Math.PI);
    ctx.font = `bold 74px ${GLYPH_FONT}`;
    ctx.fillText(rank, 0, -34);
    ctx.font = `64px ${GLYPH_FONT}`;
    ctx.fillText(glyph, 0, 36);
    ctx.restore();
  };
  drawIndex(70, 96, false);
  drawIndex(w - 70, h - 96, true);

  ctx.font = `${w * 0.62}px ${GLYPH_FONT}`;
  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 10;
  ctx.fillText(glyph, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
