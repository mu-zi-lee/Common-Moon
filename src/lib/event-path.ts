export type PathRecord = {
  id: string;
  teacher_name: string | null;
  occurred_at: string;
  marker_x: number | null;
  marker_y: number | null;
};

export type PathPoint = {
  id: string;
  index: number;
  teacher_name: string | null;
  occurred_at: string;
  x: number; // 0..1
  y: number; // 0..1
  time: string; // HH:MM
};

export type EventPath = {
  points: PathPoint[];
  totalLen: number; // sum of segment lengths in normalized units
  indexOf: (id: string) => number; // -1 if absent
  polyline: string; // "x1,y1 x2,y2 …" in normalized units (0..1)
};

export function buildEventPath(records: PathRecord[]): EventPath {
  const withPos = records
    .filter((r) => r.marker_x != null && r.marker_y != null)
    .slice()
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  const points: PathPoint[] = withPos.map((r, i) => {
    const d = new Date(r.occurred_at);
    return {
      id: r.id,
      index: i,
      teacher_name: r.teacher_name,
      occurred_at: r.occurred_at,
      x: r.marker_x!,
      y: r.marker_y!,
      time: d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    };
  });

  let totalLen = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalLen += Math.hypot(dx, dy);
  }

  return {
    points,
    totalLen,
    indexOf: (id) => points.findIndex((p) => p.id === id),
    polyline: points.map((p) => `${p.x},${p.y}`).join(" "),
  };
}
