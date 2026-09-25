import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

/**
 * Public server fn for `/t/:token` — resolves a teacher share token to a
 * curated list of that teacher's records (with signed cover URLs).
 */
export const getSharedTeacher = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => z.object({ token: z.string().min(8) }).parse(v))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase config missing");
    const anon = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data: tokRows, error: te } = await anon.rpc("resolve_teacher_share_token", {
      _token: data.token,
    });
    if (te) throw new Error(te.message);
    const tok = Array.isArray(tokRows) ? tokRows[0] : tokRows;
    if (!tok) return null;

    const { data: recs, error: re } = await anon
      .from("records")
      .select("id, photo_url, character_name, anime_name, hall, occurred_at, note, event_id")
      .eq("user_id", tok.user_id)
      .eq("teacher_name", tok.teacher_name)
      .order("occurred_at", { ascending: false })
      .limit(60);
    if (re) throw new Error(re.message);

    const eventIds = Array.from(new Set((recs ?? []).map((r) => r.event_id).filter(Boolean))) as string[];
    const eventMap = new Map<string, { name: string; year: number | null; city: string | null }>();
    if (eventIds.length) {
      const { data: evs } = await anon
        .from("events")
        .select("id, name, year, city")
        .in("id", eventIds);
      for (const e of evs ?? []) eventMap.set(e.id, { name: e.name, year: e.year, city: e.city });
    }

    // Sign the first record's cover for OG image.
    let heroUrl: string | null = null;
    const heroPath = recs?.find((r) => r.photo_url)?.photo_url;
    if (heroPath) {
      const { data: signed } = await anon.storage.from("photos").createSignedUrl(heroPath, 7 * 86400);
      heroUrl = signed?.signedUrl ?? null;
    }

    // Sign all covers for the gallery.
    const signed = await Promise.all(
      (recs ?? []).map(async (r) => {
        if (!r.photo_url) return { ...r, photoUrl: null, event: r.event_id ? eventMap.get(r.event_id) ?? null : null };
        const { data: s } = await anon.storage.from("photos").createSignedUrl(r.photo_url, 7 * 86400);
        return { ...r, photoUrl: s?.signedUrl ?? null, event: r.event_id ? eventMap.get(r.event_id) ?? null : null };
      }),
    );

    return {
      teacherName: tok.teacher_name,
      expiresAt: tok.expires_at,
      heroUrl,
      records: signed,
      total: recs?.length ?? 0,
    };
  });
