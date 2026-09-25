import { historyCatalog } from "../data/history";
import { publicPath } from "./public-path";

export const YEAR_MIN = historyCatalog.eras[0].start;
export const YEAR_MAX = historyCatalog.eras.at(-1)!.end;

export const MAP_LAYERS = [
  { year: 1939, src: publicPath("/assets/map-1939.webp"), label: "1939 · 果园与车库" },
  { year: 1968, src: publicPath("/assets/map-1968.webp"), label: "1968 · 芯片山谷" },
  { year: 1998, src: publicPath("/assets/map-1998.webp"), label: "1998 · 互联网起飞" },
  { year: 2026, src: publicPath("/assets/silicon-valley-base-map.webp"), label: "2026 · AI 与机器人" },
] as const;

export function clampYear(year: number) {
  return Math.max(YEAR_MIN, Math.min(YEAR_MAX, Math.round(year)));
}

export function clampMapScale(scale: number) {
  return Math.max(1, Math.min(2.4, Number(scale.toFixed(2))));
}

export function mapLayerLabel(year: number) {
  if (year < 1954) return MAP_LAYERS[0].label;
  if (year < 1989) return MAP_LAYERS[1].label;
  if (year < 2006) return MAP_LAYERS[2].label;
  return MAP_LAYERS[3].label;
}

export function mapLayerOpacity(index: number, year: number) {
  const anchors = MAP_LAYERS.map((item) => item.year);
  if (index < 0 || index >= anchors.length) return 0;
  if (year <= anchors[0]) return index === 0 ? 1 : 0;
  if (year >= anchors.at(-1)!) return index === anchors.length - 1 ? 1 : 0;

  let lower = 0;
  while (lower < anchors.length - 1 && year > anchors[lower + 1]) lower += 1;
  const upper = Math.min(lower + 1, anchors.length - 1);
  const progress = (year - anchors[lower]) / (anchors[upper] - anchors[lower]);
  if (index === lower) return 1 - progress;
  if (index === upper) return progress;
  return 0;
}
