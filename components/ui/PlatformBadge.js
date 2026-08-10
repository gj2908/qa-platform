import { Apple, Smartphone, Globe } from "lucide-react";

export const PLATFORM_META = {
  ios: { label: "iOS", icon: Apple, classes: "bg-platform-ios-bg text-platform-ios-fg" },
  android: { label: "Android", icon: Smartphone, classes: "bg-platform-android-bg text-platform-android-fg" },
  web: { label: "Web", icon: Globe, classes: "bg-platform-web-bg text-platform-web-fg" },
};

export default function PlatformBadge({ platform, className = "" }) {
  const meta = PLATFORM_META[platform];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${meta.classes} ${className}`}
    >
      <Icon size={12} strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}
