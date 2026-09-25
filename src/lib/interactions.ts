/**
 * Interaction badges — the "ritual" tags on each record.
 * Applied on the record itself (records.interactions text[]).
 */

export const INTERACTIONS = [
  { key: "photo", label: "合影", emoji: "📸" },
  { key: "signature", label: "签名", emoji: "✍️" },
  { key: "card", label: "名片", emoji: "🪪" },
  { key: "gift", label: "送礼", emoji: "🎁" },
  { key: "chat", label: "聊天", emoji: "💬" },
  { key: "spot", label: "偶遇", emoji: "👀" },
  { key: "commission", label: "委托", emoji: "🎨" },
] as const;

export type InteractionKey = (typeof INTERACTIONS)[number]["key"];

export const INTERACTION_KEYS: InteractionKey[] = INTERACTIONS.map((i) => i.key);

export function interactionMeta(key: string) {
  return INTERACTIONS.find((i) => i.key === key);
}

export function summarizeInteractions(list: string[]): { key: InteractionKey; count: number; label: string; emoji: string }[] {
  const counts = new Map<InteractionKey, number>();
  for (const k of list) {
    if (INTERACTION_KEYS.includes(k as InteractionKey)) {
      counts.set(k as InteractionKey, (counts.get(k as InteractionKey) ?? 0) + 1);
    }
  }
  return INTERACTIONS
    .filter((i) => counts.has(i.key))
    .map((i) => ({ key: i.key, label: i.label, emoji: i.emoji, count: counts.get(i.key)! }));
}
