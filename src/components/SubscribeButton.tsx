import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props =
  | { kind: "event"; eventId: string; label?: string }
  | { kind: "teacher"; teacherName: string; label?: string };

export function SubscribeButton(props: Props) {
  const qc = useQueryClient();
  const key = props.kind === "event" ? ["sub", "event", props.eventId] : ["sub", "teacher", props.teacherName];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const base = supabase.from("subscriptions").select("id").eq("user_id", u.user.id).eq("kind", props.kind);
      const { data } = props.kind === "event"
        ? await base.eq("event_id", props.eventId).maybeSingle()
        : await base.eq("teacher_name", props.teacherName).maybeSingle();
      return data?.id ?? null;
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("未登录");
      if (q.data) {
        const { error } = await supabase.from("subscriptions").delete().eq("id", q.data);
        if (error) throw error;
      } else {
        const row = {
          user_id: u.user.id,
          kind: props.kind,
          event_id: props.kind === "event" ? props.eventId : null,
          teacher_name: props.kind === "teacher" ? props.teacherName : null,
        };
        const { error } = await supabase.from("subscriptions").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["my-subscriptions"] });
      toast.success(q.data ? "已取消关注" : "已加入关注");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "失败"),
  });

  const active = !!q.data;
  const busy = q.isLoading || toggle.isPending;
  const label = props.label ?? (active ? "已关注" : "关注");

  return (
    <button
      onClick={() => toggle.mutate()}
      disabled={busy}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition active:scale-95 ${
        active ? "bg-surface-1 text-foreground border border-divider" : "bg-foreground text-background"
      } disabled:opacity-50`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : active ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
