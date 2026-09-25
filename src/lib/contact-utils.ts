// Utility helpers for contact platforms

export function platformUrl(platform: string, handle: string): string | null {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return null;
  switch (platform) {
    case "微博":
      return `https://weibo.com/n/${encodeURIComponent(h)}`;
    case "小红书":
      // xhs handles are opaque; we open search
      return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(h)}`;
    case "抖音":
      if (/^https?:\/\//.test(handle)) return handle;
      return `https://www.douyin.com/search/${encodeURIComponent(h)}`;
    case "B站":
      if (/^\d+$/.test(h)) return `https://space.bilibili.com/${h}`;
      return `https://search.bilibili.com/upuser?keyword=${encodeURIComponent(h)}`;
    case "X":
      return `https://x.com/${h}`;
    case "Instagram":
      return `https://instagram.com/${h}`;
    case "邮箱":
      return `mailto:${h}`;
    case "QQ":
      return `tencent://message/?uin=${h}`;
    default:
      if (/^https?:\/\//.test(handle)) return handle;
      return null;
  }
}
