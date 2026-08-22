import { LoaderCircle } from "lucide-react";

// A real switch (role="switch"/aria-checked) for boolean settings — replaces
// the app-wide pattern of relabeling a primary/secondary Button as "On"/"Off",
// which announces as a button, not a toggle, to assistive tech.
export default function Switch({ checked, onChange, disabled = false, loading = false, className = "" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-accent" : "bg-subtle border border-border"
      } ${className}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
      {loading && (
        <LoaderCircle size={10} strokeWidth={3} className="absolute inset-0 m-auto animate-spin text-white" />
      )}
    </button>
  );
}
