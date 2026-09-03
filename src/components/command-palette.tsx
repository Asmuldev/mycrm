"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchHit } from "@/app/api/search/route";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as { hits?: SearchHit[] };
        setHits(payload.hits ?? []);
        setActive(0);
      } catch {
        // Aborted by the next keystroke; nothing to report.
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  // Hits are only meaningful for the current query; clearing them in an effect
  // would just add a render pass.
  const visibleHits = query.trim().length < 2 ? [] : hits;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActive(0);
  }, []);

  const go = useCallback(
    (hit: SearchHit) => {
      close();
      router.push(hit.href);
    },
    [close, router],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
      >
        Cari...
        <kbd className="hidden rounded border border-slate-200 px-1 text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pt-24"
      onClick={close}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((current) => Math.min(current + 1, visibleHits.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Enter" && visibleHits[active]) {
              event.preventDefault();
              go(visibleHits[active]);
            }
          }}
          placeholder="Cari klien, invoice, penawaran, deal, tugas..."
          className="w-full border-b border-slate-100 bg-white px-4 py-3 text-sm outline-none"
        />

        <div className="max-h-80 overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              Ketik minimal 2 karakter
            </p>
          ) : loading && visibleHits.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">Mencari...</p>
          ) : visibleHits.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              Tidak ada hasil
            </p>
          ) : (
            <ul>
              {visibleHits.map((hit, index) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(hit)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${
                      index === active ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-slate-800">
                        {hit.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {hit.subtitle}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                      {hit.group}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
