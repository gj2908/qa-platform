import { AnimatePresence, motion } from "framer-motion";
import { Share, SquarePlus, MoreVertical } from "lucide-react";
import Button from "../ui/Button";

const STEPS = {
  ios: [
    { icon: Share, text: "Tap the Share button in Safari's toolbar" },
    { icon: SquarePlus, text: 'Scroll down and tap "Add to Home Screen"' },
  ],
  // Android/Chrome without a captured beforeinstallprompt — usually
  // because Chrome throttles re-firing it after a page's been dismissed
  // a couple of times, even though the site is still genuinely
  // installable (Chrome's own menu still offers it in that state).
  android: [
    { icon: MoreVertical, text: "Open your browser's ⋮ menu" },
    { icon: SquarePlus, text: 'Tap "Install app"' },
  ],
};

// iOS Safari never fires `beforeinstallprompt` at all — Add to Home
// Screen only exists behind the manual Share sheet there. Android/Chrome
// normally fires it, but can silently withhold it (see STEPS.android
// above); either way, this walks the user through the manual browser-menu
// path instead of a dead-end disabled button.
export default function PwaInstallInstructions({ open, onClose, platform = "ios" }) {
  const steps = STEPS[platform] || STEPS.ios;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 bg-neutral-950/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-sm rounded-lg border border-border bg-surface-raised p-5 shadow-lg"
          >
            <h2 className="text-sm font-semibold text-ink-primary">Install app</h2>
            <ol className="mt-3 space-y-3 text-sm text-ink-secondary">
              {steps.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-hover text-ink-secondary">
                    <Icon size={14} strokeWidth={2} />
                  </span>
                  {text}
                </li>
              ))}
            </ol>
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Got it
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
