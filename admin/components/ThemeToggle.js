import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

const OPTIONS = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "device", label: "Device", icon: Monitor },
];

export default function ThemeToggle() {
  const { preference, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900"
    >
      {OPTIONS.map(({ key, label, icon: Icon }) => {
        const active = preference === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setTheme(key)}
            className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
              active
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <Icon size={14} strokeWidth={2} />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
