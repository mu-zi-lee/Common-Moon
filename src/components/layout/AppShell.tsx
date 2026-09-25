import { useEffect, useState, type ReactNode } from "react";
import { BottomTabBar } from "./BottomTabBar";
import { GlobalSearchSheet } from "@/components/GlobalSearchSheet";
import { Search } from "lucide-react";

export function AppShell({
  title,
  eyebrow,
  right,
  children,
  hideTabs,
  onBack,
  hideSearch,
}: {
  title?: string;
  eyebrow?: string;
  right?: ReactNode;
  children: ReactNode;
  hideTabs?: boolean;
  onBack?: () => void;
  hideSearch?: boolean;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (hideSearch) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hideSearch]);

  const searchBtn = !hideSearch && (
    <button
      onClick={() => setSearchOpen(true)}
      className="rounded-full p-2 text-foreground/80 active:scale-95 transition ease-editorial"
      aria-label="搜索"
    >
      <Search className="h-5 w-5" strokeWidth={1.6} />
    </button>
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      {(title || right || onBack || searchBtn) && (
        <header className="sticky top-0 z-30 glass hairline-b safe-top">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              {onBack && (
                <button
                  onClick={onBack}
                  className="-ml-2 rounded-full p-2 text-foreground/80 active:scale-95 ease-editorial transition"
                  aria-label="返回"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
              )}
              <div className="min-w-0">
                {eyebrow && <p className="eyebrow leading-none">{eyebrow}</p>}
                {title && (
                  <h1 className={`display-title truncate ${eyebrow ? "mt-0.5 text-[22px]" : "text-[24px]"}`}>{title}</h1>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {right}
              {searchBtn}
            </div>
          </div>
        </header>
      )}
      <main className="mx-auto max-w-md px-4 py-4">{children}</main>
      {!hideTabs && <BottomTabBar />}
      <GlobalSearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
