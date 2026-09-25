// Known venue presets — used to normalize AI map recognition output.
// Keeps app UI monochrome; presets only provide structural data.

export type VenuePreset = {
  id: string;
  venue: string;
  event: string;
  halls: string[];
  // signals used to match AI output back onto this preset
  eventAliases: string[];
  hallPattern: RegExp;
  keywords: string[];
};

export const venuePresets: VenuePreset[] = [
  {
    id: "bw-shanghai",
    venue: "上海国家会展中心",
    event: "BiliBili World",
    halls: ["1.1H", "2.1H", "3H", "4.1H", "5.1H", "6.1H", "7.1H", "8.1H"],
    eventAliases: ["BiliBili World", "bilibiliworld", "BW", "哔哩哔哩世界"],
    hallPattern: /^\d(\.1)?H$/i,
    keywords: ["BiliBiliWorld", "上海·国家会展中心", "国家会展中心", "北厅", "南厅", "东厅", "西厅"],
  },
];

export function matchPreset(input: {
  venue?: string | null;
  event?: string | null;
  halls?: string[] | null;
}): VenuePreset | null {
  const hay = `${input.venue ?? ""}\n${input.event ?? ""}\n${(input.halls ?? []).join(" ")}`.toLowerCase();
  for (const p of venuePresets) {
    const hitAlias = p.eventAliases.some((a) => hay.includes(a.toLowerCase()));
    const hitVenue = p.venue && hay.includes(p.venue.toLowerCase());
    const hitHall = (input.halls ?? []).some((h) => p.hallPattern.test(h));
    if (hitAlias || hitVenue || hitHall) return p;
  }
  return null;
}
