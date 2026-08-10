import { CircleAlert } from "lucide-react";

export default function FormField({ label, htmlFor, hint, error, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink-primary">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-danger">
          <CircleAlert size={12} strokeWidth={2.5} />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}
