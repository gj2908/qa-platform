import { useState } from "react";
import { getAvatarColor } from "../../lib/avatarColor";

const SIZE_CLASSES = {
  xs: "h-4 w-4 text-[9px]",
  sm: "h-5 w-5 text-[10px]",
  team: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-xs",
  lg: "h-9 w-9 text-sm",
};

// Shared "image if we have one, initials otherwise" avatar, so every
// consumer (nav menu, team lists, board cards) renders avatar_url the
// same way instead of repeating the getAvatarColor+initials JSX. `seed`
// drives the fallback color (usually email, always present); `displayName`
// drives the fallback letter (falls back to seed if no name yet).
export default function Avatar({ avatarUrl, seed, displayName, size = "md", className = "" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const label = displayName || seed || "?";

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`shrink-0 rounded-full object-cover ${sizeClass} ${className}`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  const color = getAvatarColor(seed);
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sizeClass} ${color.bg} ${color.text} ${className}`}
    >
      {label[0].toUpperCase()}
    </span>
  );
}
