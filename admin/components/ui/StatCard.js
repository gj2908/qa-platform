import Link from "next/link";
import { motion } from "framer-motion";

const TONES = {
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  primary: "bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300",
  success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function StatCard({ icon: Icon, label, value, index = 0, tone = "neutral", href }) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={`rounded-lg border border-slate-200 bg-white p-4 transition-shadow dark:border-slate-800 dark:bg-slate-900 ${
        href ? "hover:border-slate-300 hover:shadow-sm dark:hover:border-slate-700" : "hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${TONES[tone]}`}>
          <Icon size={14} strokeWidth={2} />
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="mt-2.5 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </motion.div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
