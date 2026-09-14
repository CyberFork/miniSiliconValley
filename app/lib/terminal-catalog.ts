export type TerminalItemSlot = "identity" | "terminal" | "space";

export type TerminalShopItem = {
  id: string;
  slot: TerminalItemSlot;
  name: string;
  description: string;
  priceCoins: number;
  accent: string;
  glyph: string;
};

/** V1 is deliberately finite and deterministic. Achievements and learning
 * access never appear in this paid catalogue. */
export const TERMINAL_SHOP_ITEMS: readonly TerminalShopItem[] = [
  { id: "identity-signal-teal", slot: "identity", name: "青绿信号身份框", description: "给身份牌加一圈青绿信号灯，不改变任何权限。", priceCoins: 12, accent: "#68c9bc", glyph: "ID" },
  { id: "identity-solar-gold", slot: "identity", name: "太阳金身份框", description: "把身份牌换成太阳金电路边框。", priceCoins: 18, accent: "#f1c75b", glyph: "ID" },
  { id: "terminal-blueprint", slot: "terminal", name: "蓝图终端主题", description: "深蓝网格与工程图纸质感。", priceCoins: 20, accent: "#5f9fd8", glyph: "UI" },
  { id: "terminal-aurora", slot: "terminal", name: "极光终端主题", description: "青绿与紫蓝的夜空信号主题。", priceCoins: 24, accent: "#8e8de8", glyph: "UI" },
  { id: "space-pixel-plant", slot: "space", name: "像素生态盆栽", description: "摆进公开空间的低碳实验植物。", priceCoins: 16, accent: "#78b86a", glyph: "🌱" },
  { id: "space-moon-rocket", slot: "space", name: "月球试验火箭", description: "一枚代表大胆试验的桌面火箭。", priceCoins: 28, accent: "#ee765b", glyph: "🚀" },
] as const;

export function terminalItem(itemId: string): TerminalShopItem | null {
  return TERMINAL_SHOP_ITEMS.find((item) => item.id === itemId) ?? null;
}
