import { z } from "zod";
import { INTERACTION_KEYS } from "./interactions";

export const contactPlatforms = ["微博", "小红书", "抖音", "B站", "X", "Instagram", "QQ", "邮箱", "其他"] as const;
export type ContactPlatform = (typeof contactPlatforms)[number];

export const recordSchema = z.object({
  teacher_name: z.string().trim().max(80).optional().nullable(),
  character_name: z.string().trim().max(80).optional().nullable(),
  anime_name: z.string().trim().max(120).optional().nullable(),
  hall: z.string().trim().max(40).optional().nullable(),
  booth: z.string().trim().max(24).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  favorite: z.boolean().default(false),
  rating: z.number().int().min(0).max(5).default(0),
  interactions: z.array(z.enum(INTERACTION_KEYS as [string, ...string[]])).default([]),
  occurred_at: z.string().optional(),
  event_id: z.string().uuid().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  marker_x: z.number().min(0).max(1).optional().nullable(),
  marker_y: z.number().min(0).max(1).optional().nullable(),
});

export const contactSchema = z.object({
  platform: z.string().max(20),
  handle: z.string().trim().min(1).max(100),
});

export const eventSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  year: z.number().int().min(2000).max(2100).optional().nullable(),
  city: z.string().trim().max(40).optional().nullable(),
  map_image_url: z.string().optional().nullable(),
});

export const authSchema = z.object({
  email: z.string().trim().email("邮箱格式不正确").max(255),
  password: z.string().min(6, "至少 6 位").max(128),
});

/* ---------------- merch / expenses ---------------- */

export const MERCH_KINDS = [
  { key: "goods", label: "周边" },
  { key: "ticket", label: "门票" },
  { key: "poster", label: "海报" },
  { key: "gift", label: "礼物" },
  { key: "photo_print", label: "拍立得" },
  { key: "other", label: "其他" },
] as const;
export type MerchKind = (typeof MERCH_KINDS)[number]["key"];
export const MERCH_KIND_KEYS = MERCH_KINDS.map((k) => k.key);

export const EXPENSE_CATEGORIES = [
  { key: "ticket", label: "门票", emoji: "🎫" },
  { key: "travel", label: "交通", emoji: "🚄" },
  { key: "lodging", label: "住宿", emoji: "🏨" },
  { key: "food", label: "餐饮", emoji: "🍜" },
  { key: "merch", label: "周边", emoji: "🎁" },
  { key: "gift", label: "礼物", emoji: "💐" },
  { key: "other", label: "其他", emoji: "📦" },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["key"];
export const EXPENSE_CATEGORY_KEYS = EXPENSE_CATEGORIES.map((k) => k.key);
