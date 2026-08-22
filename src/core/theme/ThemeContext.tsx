"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("platform_admin_theme") as Theme | null;
    if (saved === "light" || saved === "dark") {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      // Default to light
      setThemeState("light");
      applyTheme("light");
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "platform_admin_theme" && (e.newValue === "light" || e.newValue === "dark")) {
        setThemeState(e.newValue);
        applyTheme(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const applyTheme = (t: Theme) => {
    if (typeof document !== "undefined") {
      if (t === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
        document.documentElement.style.colorScheme = "dark";
      } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
        document.documentElement.style.colorScheme = "light";
      }
    }
  };

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem("platform_admin_theme", next);
    applyTheme(next);
  };

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
  };

  const isDark = theme === "dark";

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function AppleThemeToggle({ className }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "Light" : "Dark"} theme`}
      title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
      className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 focus:outline-none cursor-pointer ${
        isDark
          ? "bg-[#181C28] border border-white/[0.12]"
          : "bg-[#E5E5EA] border border-black/[0.08]"
      } ${className || ""}`}
    >
      {/* Sliding Thumb */}
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full shadow-md transition-transform duration-300 ease-in-out flex items-center justify-center ${
          isDark
            ? "translate-x-7 bg-[#2E354B] text-blue-200"
            : "translate-x-0.5 bg-white text-amber-500 shadow-slate-900/10"
        }`}
      >
        {isDark ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
      </span>

      {/* Sun Icon Placeholder (Left) */}
      <span className="flex-1 flex justify-center text-slate-400">
        <svg className={`w-3.5 h-3.5 transition-opacity ${!isDark ? "opacity-0" : "opacity-40"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </span>

      {/* Moon Icon Placeholder (Right) */}
      <span className="flex-1 flex justify-center text-slate-400">
        <svg className={`w-3.5 h-3.5 transition-opacity ${isDark ? "opacity-0" : "opacity-40"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </span>
    </button>
  );
}
