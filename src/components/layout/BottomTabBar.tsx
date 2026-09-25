import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListChecks, Landmark, Package, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "首页", icon: Home, exact: true },
  { to: "/records", label: "记录", icon: ListChecks },
  { to: "/events", label: "展会", icon: Landmark },
  { to: "/collection", label: "收藏", icon: Package },
  { to: "/me", label: "我的", icon: User },
] as const;

function haptic() {
  try { navigator.vibrate?.(8); } catch { /* noop */ }
}

export function BottomTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 glass hairline-t safe-bottom">
        <div className="mx-auto grid max-w-md grid-cols-5 px-2 pt-2">
          {tabs.map((t) => {
            const active = isActive(t.to, "exact" in t ? t.exact : false);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                onClick={haptic}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 pb-2 pt-2 text-[10px] transition-colors ease-editorial",
                  active ? "text-foreground" : "text-muted-foreground/70",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0 h-[2px] rounded-full bg-foreground transition-all ease-editorial",
                    active ? "w-7 opacity-100" : "w-0 opacity-0",
                  )}
                />
                <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2 : 1.6} />
                <span className={cn("tracking-wider", active && "font-semibold")}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <Link
        to="/records/new"
        onClick={haptic}
        className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-editorial active:scale-95 transition ease-editorial"
        aria-label="新增记录"
      >
        <Plus className="h-6 w-6" strokeWidth={2} />
      </Link>
    </>
  );
}
