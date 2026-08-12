import fs from "fs";
import path from "path";
import AppShell from "../components/layout/AppShell";
import ChangelogContent from "../components/ChangelogContent";

// Named changelog-log (not changelog) to avoid colliding with the
// per-project pages/projects/[id]/changelog.js route. Reads the repo's
// own CHANGELOG.md at build time — a "what's new" reference for the
// platform itself, not a frequently-used surface, so it isn't in the
// main nav.
export async function getStaticProps() {
  const markdown = fs.readFileSync(path.join(process.cwd(), "..", "CHANGELOG.md"), "utf8");
  return { props: { markdown } };
}

export default function PlatformChangelog({ markdown }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <ChangelogContent markdown={markdown} />
      </div>
    </AppShell>
  );
}
