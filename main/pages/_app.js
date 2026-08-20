import { useEffect } from "react";
import Head from "next/head";
import { Inter } from "next/font/google";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import "../styles/globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { ToastProvider } from "../components/ui/ToastProvider";
import { isAppShellPath } from "../lib/publicRoutes";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
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
        <Head>
          <title>Vrsnify</title>
          <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
          {isAppShell && (
            <>
              <link rel="manifest" href="/manifest.json" />
              <link rel="apple-touch-icon" href="/icons/icon-192.png" />
              <meta name="theme-color" content="#3358d4" />
            </>
          )}
        </Head>
        <div className={`${inter.variable} font-sans min-h-screen bg-canvas text-ink-primary`}>
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
      </ToastProvider>
    </ThemeProvider>
  );
}
