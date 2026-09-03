"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "crm-theme";
const CHANGE_EVENT = "crm-theme-change";

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Reads the theme straight from localStorage rather than mirroring it into
 * React state, so the first client render already matches what the inline
 * script in the document head applied.
 */
function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMediaChange = () => {
    if (read() === "system") applyTheme("system");
    onChange();
  };

  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  media.addEventListener("change", onMediaChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onMediaChange);
  };
}

function read(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
}

const options: Array<{ value: Theme; icon: typeof Sun; label: string }> = [
  { value: "light", icon: Sun, label: "Terang" },
  { value: "dark", icon: Moon, label: "Gelap" },
  { value: "system", icon: Monitor, label: "Ikuti sistem" },
];

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  function choose(next: Theme) {
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-label={option.label}
            aria-pressed={theme === option.value}
            onClick={() => choose(option.value)}
            className={`rounded-md p-1.5 transition ${
              theme === option.value
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
