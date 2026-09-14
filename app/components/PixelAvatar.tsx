import type { CSSProperties } from "react";
import styles from "./pixel-avatar.module.css";

const PALETTES = [
  ["#2558db", "#70dfb3"],
  ["#ef6545", "#e5b847"],
  ["#2b8e84", "#dbaa39"],
  ["#714fc8", "#72c7e8"],
] as const;

/** Stable, local-only 5×5 avatar. No learner data is sent to a third party. */
export function PixelAvatar({ seed, label, size = "medium" }: { seed: string; label: string; size?: "small" | "medium" | "large" }) {
  const hash = hashSeed(seed);
  const palette = PALETTES[hash % PALETTES.length];
  const cells: boolean[] = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const mirrored = column > 2 ? 4 - column : column;
      const bit = (hash >>> ((row * 3 + mirrored) % 24)) & 1;
      cells.push(Boolean(bit || (row === 2 && mirrored === 2)));
    }
  }
  return <span
    className={styles.avatar}
    data-size={size}
    role="img"
    aria-label={`${label} 的像素头像`}
    style={{ "--pixel-bg": palette[0], "--pixel-fg": palette[1] } as CSSProperties}
  >{cells.map((on, index) => <i key={index} data-on={on} />)}</span>;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
