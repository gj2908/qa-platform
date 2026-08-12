import fs from "fs";
import path from "path";
import AppShell from "../components/layout/AppShell";
import ChangelogContent from "../components/ChangelogContent";

// Named changelog-log (not changelog) to avoid colliding with the
// per-project pages/projects/[id]/changelog.js route. Reads CHANGELOG.md
// at build time — a "what's new" reference for the platform itself, not
// a frequently-used surface, so it isn't in the main nav.
//
// Reads main/CHANGELOG.md (a copy of the repo-root one), not "../CHANGELOG.md"
// — Vercel's build sandbox for a subdirectory-rooted project (this repo
// has main/ and admin/ as separate Vercel projects) doesn't expose files
// outside the project's root directory at build time, even though the
// full repo is cloned. Keep this file in sync with the root CHANGELOG.md
// (the GitHub-facing one) when adding entries.
export async function getStaticProps() {
  const markdown = fs.readFileSync(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
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
