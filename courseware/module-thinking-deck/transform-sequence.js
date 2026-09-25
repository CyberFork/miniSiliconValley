// Elapsed-time interpolation: identical 5-second phases at any frame rate.
export const TRANSFORM_DURATION_MS = 5000;
export function sampleTransformPhase(elapsedMs) {
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  if (elapsed >= TRANSFORM_DURATION_MS) return {phase:'complete',progress:1};
  const phase = elapsed < 2000 ? 'explode' : 'assemble';
  const linear = phase === 'explode' ? elapsed / 2000 : (elapsed - 2000) / 3000;
  return {phase,progress:linear * linear * (3 - 2 * linear)};
}
