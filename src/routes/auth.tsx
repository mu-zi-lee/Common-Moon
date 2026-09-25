import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { authSchema } from "@/lib/schemas";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => { document.title = "登录 · CosLog"; }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = authSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "请填写正确信息");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("注册成功，正在登录…");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) { toast.error(String(result.error)); return; }
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google 登录失败");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="10" r="4"/><circle cx="12" cy="18" r="1.5"/></svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">CosLog</h1>
          <p className="mt-1 text-sm text-muted-foreground">记录每一次遇见 Cosplayer</p>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-sm">
          <div className="mb-4 flex rounded-2xl bg-muted p-1 text-sm">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-xl py-2 font-medium transition ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >登录</button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-xl py-2 font-medium transition ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >注册</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">邮箱</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-11 w-full rounded-2xl border border-input bg-background px-4 text-base outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">密码</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-2xl border border-input bg-background px-4 text-base outline-none focus:border-primary" />
            </div>
            <button type="submit" disabled={loading}
              className="mt-2 flex h-11 w-full items-center justify-center rounded-2xl bg-primary font-medium text-primary-foreground active:scale-[0.98] transition disabled:opacity-60">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === "signin" ? "登录" : "创建账号"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> 或 <div className="h-px flex-1 bg-border" />
          </div>

          <button onClick={handleGoogle} disabled={googleLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-input bg-card font-medium active:scale-[0.98] transition disabled:opacity-60">
            {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11 0 20-8 20-20 0-1.7-.2-3.4-.5-5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12.5 24 12.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/><path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.5 41 16.2 45.5 24 45.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.2 5.2c-.4.4 6.5-4.7 6.5-13.8 0-1.7-.2-3.4-.5-5z"/></svg>
              使用 Google 继续
            </>}
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">继续即表示你同意保存个人漫展记录数据。</p>
      </motion.div>
    </div>
  );
}
