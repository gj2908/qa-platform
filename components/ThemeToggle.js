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
      className="flex items-center gap-0.5 rounded-md border border-border bg-subtle p-0.5"
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
                ? "bg-surface text-ink-primary shadow-sm"
                : "text-ink-tertiary hover:text-ink-secondary"
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
