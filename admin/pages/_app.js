import Head from "next/head";
import "../styles/globals.css";
import { ThemeProvider } from "../components/ThemeProvider";

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <Head>
        <title>QA Admin</title>
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
      </Head>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
