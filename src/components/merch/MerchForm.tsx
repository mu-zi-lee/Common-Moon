import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/storage";
import { StorageImage } from "@/components/StorageImage";
import { upsertMerch } from "@/lib/merch.functions";
import { MERCH_KINDS, type MerchKind } from "@/lib/schemas";
import { StarRating } from "@/components/StarRating";
import { Camera, Loader2, X, Heart } from "lucide-react";

export type MerchDraft = {
  id?: string;
  event_id: string | null;
  kind: MerchKind;
  name: string;
  source: string;
  price: string; // free text; parse on save
  currency: string;
  photo_urls: string[];
  note: string;
  acquired_at: string;
  rating: number;
  favorite: boolean;
};

export const emptyMerch: MerchDraft = {
  event_id: null,
  kind: "goods",
  name: "",
  source: "",
  price: "",
  currency: "CNY",
  photo_urls: [],
  note: "",
  acquired_at: new Date().toISOString(),
  rating: 0,
  favorite: false,
};

export function MerchForm({ initial }: { initial?: MerchDraft }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertMerch);
  const [draft, setDraft] = useState<MerchDraft>(initial ?? emptyMerch);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const events = useQuery({
    queryKey: ["events-lite"],
    queryFn: async () => (await supabase.from("events").select("id, name, year").order("created_at", { ascending: false })).data ?? [],
  });

  const update = (p: Partial<MerchDraft>) => setDraft((d) => ({ ...d, ...p }));

  async function handlePick(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    try {
      const paths = await Promise.all(files.map((f) => uploadImage("merch", f)));
      update({ photo_urls: [...draft.photo_urls, ...paths] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("名称必填");
      const price = draft.price.trim() ? Number(draft.price) : null;
      if (price != null && (isNaN(price) || price < 0)) throw new Error("价格格式不对");
      return upsertFn({
        data: {
          id: draft.id,
          event_id: draft.event_id,
          kind: draft.kind,
          name: draft.name.trim(),
          source: draft.source.trim() || null,
          price,
          currency: draft.currency,
          photo_urls: draft.photo_urls,
          note: draft.note.trim() || null,
          acquired_at: draft.acquired_at,
          rating: draft.rating,
          favorite: draft.favorite,
        },
      });
    },
    onSuccess: ({ id }) => {
      qc.invalidateQueries();
      toast.success("已保存");
      navigate({ to: "/collection/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "保存失败"),
  });

  return (
    <div className="pb-32">
      {/* Photos */}
      <section>
        <h2 className="text-xl font-bold">照片</h2>
        {draft.photo_urls.length === 0 ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-3 flex aspect-[4/3] w-full items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/30"
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Camera className="h-8 w-8 text-muted-foreground" />}
          </button>
        ) : (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {draft.photo_urls.map((p, i) => (
              <div key={p} className="relative shrink-0">
                <StorageImage bucket="merch" path={p} className="h-24 w-24 rounded-xl" />
                <button
                  onClick={() => update({ photo_urls: draft.photo_urls.filter((_, k) => k !== i) })}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow"
                  aria-label="移除"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => inputRef.current?.click()}
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            if (list.length) handlePick(list);
            e.target.value = "";
          }}
        />
      </section>

      {/* Kind chips */}
      <section className="mt-6">
        <label className="text-xs font-medium text-muted-foreground">类型</label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MERCH_KINDS.map((k) => {
            const active = draft.kind === k.key;
            return (
              <button
                key={k.key}
                onClick={() => update({ kind: k.key })}
                className={`h-9 rounded-full px-3.5 text-xs font-medium transition ${
                  active ? "bg-foreground text-background" : "bg-surface-1 text-foreground/70"
                }`}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Fields */}
      <section className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">名称</label>
          <input
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 text-base outline-none focus:border-primary"
            placeholder="限定亚克力立牌 / 门票 / …"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground">价格 (可选)</label>
          <div className="mt-1.5 flex items-stretch gap-2">
            <input
              value={draft.price}
              onChange={(e) => update({ price: e.target.value })}
              inputMode="decimal"
              className="h-11 min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 text-base outline-none focus:border-primary tabular"
              placeholder="80"
            />
            <select
              value={draft.currency}
              onChange={(e) => update({ currency: e.target.value })}
              aria-label="币种"
              className="h-11 w-24 shrink-0 rounded-2xl border border-input bg-background px-3 text-base tabular outline-none focus:border-primary appearance-none text-center"
            >
              <option value="CNY">¥ CNY</option>
              <option value="JPY">¥ JPY</option>
              <option value="USD">$ USD</option>
              <option value="HKD">HK$</option>
              <option value="TWD">NT$</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">来源 / 摊位</label>
          <input
            value={draft.source}
            onChange={(e) => update({ source: e.target.value })}
            className="mt-1.5 h-11 w-full rounded-2xl border border-input bg-background px-4 text-base outline-none focus:border-primary"
            placeholder="官方摊位 / 某某老师"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">所属展会 (可选)</label>
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => update({ event_id: null })}
              className={`h-9 shrink-0 rounded-full px-3.5 text-xs font-medium ${
                !draft.event_id ? "bg-foreground text-background" : "bg-surface-1"
              }`}
            >
              无
            </button>
            {(events.data ?? []).map((e) => (
              <button
                key={e.id}
                onClick={() => update({ event_id: e.id })}
                className={`h-9 shrink-0 rounded-full px-3.5 text-xs font-medium ${
                  draft.event_id === e.id ? "bg-foreground text-background" : "bg-surface-1"
                }`}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-3xl border border-border/50 bg-card p-4">
          <button onClick={() => update({ favorite: !draft.favorite })} className="flex items-center gap-2 active:scale-95">
            <Heart className={`h-7 w-7 transition ${draft.favorite ? "fill-rose-500 text-rose-500" : "text-muted-foreground/50"}`} />
            <span className="text-sm font-medium">{draft.favorite ? "已收藏" : "收藏"}</span>
          </button>
          <StarRating value={draft.rating} onChange={(v) => update({ rating: v })} size={24} />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">备注</label>
          <textarea
            value={draft.note}
            onChange={(e) => update({ note: e.target.value })}
            rows={3}
            className="mt-1.5 w-full rounded-2xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
            placeholder="联名款 / 编号 / 保存注意事项…"
          />
        </div>
      </section>

      {/* Save */}
      <div className="fixed inset-x-0 bottom-0 z-40 glass border-t border-border safe-bottom">
        <div className="mx-auto max-w-md p-3">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || uploading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-medium text-primary-foreground active:scale-[0.98] disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
