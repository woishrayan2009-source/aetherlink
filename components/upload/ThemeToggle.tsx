"use client";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <div className="absolute top-4 right-4 z-50">
      <button
        onClick={onToggle}
        className={`p-3 rounded-xl transition-all duration-300 ${
          isDark
            ? 'bg-white/10 hover:bg-white/20 border border-white/20'
            : 'bg-cyan-100 hover:bg-cyan-200 border border-cyan-300'
        }`}
      >
        {isDark ? <Sun className="w-5 h-5 text-yellow-300" /> : <Moon className="w-5 h-5 text-cyan-700" />}
      </button>
    </div>
  );
}
