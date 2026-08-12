import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "../ThemeToggle";

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex items-center justify-between px-6 py-5">
        <Link href="/">
          <Logo />
        </Link>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-20">
        <div className="w-full max-w-[360px]">{children}</div>
      </div>
    </div>
  );
}
