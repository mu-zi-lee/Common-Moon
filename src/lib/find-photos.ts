/**
 * "Find photos" helper — generate deep links to social platforms so users
 * can hunt down photos of a cosplayer from a specific event.
 */

export type FindTarget = {
  label: string;
  key: "weibo" | "xhs" | "lofter" | "x" | "douyin" | "bilibili" | "google";
  url: (q: string) => string;
};

export const FIND_TARGETS: FindTarget[] = [
  { label: "微博", key: "weibo", url: (q) => `https://s.weibo.com/weibo?q=${encodeURIComponent(q)}` },
  { label: "小红书", key: "xhs", url: (q) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}` },
  { label: "Lofter", key: "lofter", url: (q) => `https://www.lofter.com/tag/${encodeURIComponent(q)}` },
  { label: "X (Twitter)", key: "x", url: (q) => `https://x.com/search?q=${encodeURIComponent(q)}&f=media` },
  { label: "抖音", key: "douyin", url: (q) => `https://www.douyin.com/search/${encodeURIComponent(q)}` },
  { label: "B站", key: "bilibili", url: (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}` },
  { label: "Google 图片", key: "google", url: (q) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}` },
];

export function buildQuery({
  character,
  anime,
  event,
  teacher,
}: {
  character?: string | null;
  anime?: string | null;
  event?: string | null;
  teacher?: string | null;
}): string {
  const parts: string[] = [];
  if (character) parts.push(character);
  else if (teacher) parts.push(teacher);
  if (anime) parts.push(anime);
  if (event) parts.push(event);
  parts.push("cosplay");
  return parts.filter(Boolean).join(" ");
}
