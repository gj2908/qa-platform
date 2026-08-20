import { AnimatePresence, motion } from "framer-motion";
import { Share, SquarePlus } from "lucide-react";
import Button from "../ui/Button";

// iOS Safari never fires `beforeinstallprompt` — Add to Home Screen only
// exists behind the manual Share sheet there, so this walks the user
// through it instead of a native prompt.
export default function PwaInstallInstructions({ open, onClose }) {
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
              <li className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-hover text-ink-secondary">
                  <Share size={14} strokeWidth={2} />
                </span>
                Tap the Share button in Safari's toolbar
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-hover text-ink-secondary">
                  <SquarePlus size={14} strokeWidth={2} />
                </span>
                Scroll down and tap "Add to Home Screen"
              </li>
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
