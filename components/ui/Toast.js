import { CircleCheck, CircleAlert, X } from "lucide-react";

const TONES = {
  success: {
    icon: CircleCheck,
    className: "bg-success-subtle text-success-subtle-fg",
  },
  error: {
    icon: CircleAlert,
    className: "bg-danger-subtle text-danger-subtle-fg",
  },
};

export default function Toast({ tone = "success", message, onDismiss }) {
  const { icon: Icon, className } = TONES[tone];
  return (
    <div
      className={`flex items-center gap-2.5 rounded-md px-3.5 py-2.5 text-sm shadow-lg ${className}`}
      role="status"
    >
      <Icon size={15} strokeWidth={2.25} className="shrink-0" />
      <p className="flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <X size={13} strokeWidth={2.25} />
      </button>
    </div>
  );
}
