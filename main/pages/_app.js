import { useEffect } from "react";
import Head from "next/head";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import "../styles/globals.css";
// Imported for its module-level `beforeinstallprompt` listener side
// effect — must load before any gate/TopNav/UserMenu component gets a
// chance to mount, since that one-time browser event fires early and
// Chrome never re-dispatches it. See lib/pwaInstallPrompt.js.
import "../lib/pwaInstallPrompt";
import { ThemeProvider } from "../components/ThemeProvider";
import { ToastProvider } from "../components/ui/ToastProvider";
import { TooltipProvider } from "../components/shadcn/tooltip";
import { isAppShellPath } from "../lib/publicRoutes";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Display face for landing-page headlines only, and a monospace face used
// as this redesign's signature device — version numbers/build tags render
// in real monospace to tie the UI back to the product's actual subject
// (shipping/versioning) instead of it being decorative. See
// components/ui/VersionTag.js and pages/index.js.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isAppShell = isAppShellPath(router.pathname);

  // Installability (manifest + service worker) is scoped to pages only a
  // signed-in user reaches — never the public upload landing, the public
  // tester-facing pages, or the pre-auth login/forgot-password/reset-
  // password pages (see lib/publicRoutes.js's isAppShellPath). This only
  // registers the SW for install support; push subscription still
  // requires the user to opt in from Settings (lib/pushSubscribe.js).
  useEffect(() => {
    if (isAppShell && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [isAppShell]);

  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <Head>
            <title>Vrsnify</title>
            <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
            {/* theme-color itself is set by lib/theme.js's themeInitScript
                (pages/_document.js) so it tracks the app's actual surface
                color per light/dark theme, rather than being pinned to the
                accent blue here regardless of theme. */}
            {isAppShell && (
              <>
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/icons/icon-192.png" />
              </>
            )}
          </Head>
          <div
            className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans min-h-screen bg-canvas text-ink-primary`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={router.pathname}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Component {...pageProps} />
              </motion.div>
            </AnimatePresence>
          </div>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
