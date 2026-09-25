import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

/**
 * Public server fn for the /share/:token page. Uses the publishable-key
 * anon client + narrow RLS policies (`anon reads shared records/events`)
 * so it works during SSR/prerender with no auth.
 */
export const getSharedRecord = createServerFn({ method: "GET" })
  .inputValidator((v: unknown) => z.object({ token: z.string().min(8) }).parse(v))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase config missing");
    const anon = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data: tokRows, error: te } = await anon.rpc("resolve_share_token", {
      _token: data.token,
    });
    if (te) throw new Error(te.message);
    const tok = Array.isArray(tokRows) ? tokRows[0] : tokRows;
    if (!tok) return null;

    const { data: rec, error: re } = await anon
      .from("records")
      .select("id, photo_url, photo_urls, teacher_name, character_name, anime_name, hall, occurred_at, note, event_id")
      .eq("id", tok.record_id)
      .maybeSingle();
    if (re) throw new Error(re.message);
    if (!rec) return null;

    let eventName: string | null = null;
    let eventCity: string | null = null;
    let eventYear: number | null = null;
    if (rec.event_id) {
      const { data: ev } = await anon
        .from("events")
        .select("name, city, year")
        .eq("id", rec.event_id)
        .maybeSingle();
      if (ev) {
        eventName = ev.name;
        eventCity = ev.city;
        eventYear = ev.year;
      }
    }

    // Sign the cover photo (photos bucket is private) with a 7-day URL so
    // the shared page can render without authentication.
    let photoSignedUrl: string | null = null;
    if (rec.photo_url) {
      const { data: signed } = await anon.storage
        .from("photos")
        .createSignedUrl(rec.photo_url, 7 * 86400);
      photoSignedUrl = signed?.signedUrl ?? null;
    }

    return {
      teacher_name: rec.teacher_name,
      character_name: rec.character_name,
      anime_name: rec.anime_name,
      hall: rec.hall,
      occurred_at: rec.occurred_at,
      note: rec.note,
      event: eventName
        ? { name: eventName, city: eventCity, year: eventYear }
        : null,
      photoUrl: photoSignedUrl,
      expiresAt: tok.expires_at,
    };
  });
