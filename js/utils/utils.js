// ============================================================
// UTILS.JS — helpers puros, sem estado
// ============================================================

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

export function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

export function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// Colisão AABB simplificada em 2 eixos (lane = X discreto, Z = profundidade),
// usada para obstáculos/moedas que já estão "encaixados" em uma faixa.
export function zOverlap(z, targetZ, halfDepth) {
  return z > targetZ - halfDepth && z < targetZ + halfDepth;
}

// Distância 2D (X,Z) — usada para o ímã de moedas e coleta
export function dist2D(x1, z1, x2, z2) {
  const dx = x1 - x2, dz = z1 - z2;
  return Math.sqrt(dx * dx + dz * dz);
}

export function formatNumber(n) {
  return Math.floor(n).toLocaleString('pt-BR');
}
