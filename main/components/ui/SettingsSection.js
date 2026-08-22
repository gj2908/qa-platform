// A labeled group of settings cards — replaces the "long flat stack of
// same-weight cards" pattern on settings pages with scannable sections.
// `columns={2}` lets small toggle-only cards sit two-up instead of each
// claiming a full row; leave at the default 1 for cards with lists/forms
// that need full width.
export default function SettingsSection({ title, description, columns = 1, className = "", children }) {
  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <div>
        <h2 className="text-sm font-semibold text-ink-primary">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-tertiary">{description}</p>}
      </div>
      <div className={`grid grid-cols-1 gap-4 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>
    </section>
  );
}
