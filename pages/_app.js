import { Inter } from "next/font/google";
import "../styles/globals.css";
import { ThemeProvider } from "../components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <div className={`${inter.variable} font-sans min-h-screen bg-canvas text-ink-primary`}>
        <Component {...pageProps} />
      </div>
    </ThemeProvider>
  );
}
