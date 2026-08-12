import Logo from "../../components/layout/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import Card from "../../components/ui/Card";

function Endpoint({ method, path, description, example }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="rounded bg-accent-subtle px-1.5 py-0.5 font-mono text-xs font-semibold text-accent-subtle-fg">
          {method}
        </span>
        <code className="text-sm text-ink-primary">{path}</code>
      </div>
      <p className="mt-2 text-sm text-ink-tertiary">{description}</p>
      <pre className="mt-3 overflow-x-auto rounded-md bg-subtle px-3.5 py-2.5 text-xs text-ink-secondary">
        {example}
      </pre>
    </Card>
  );
}

// Public docs page for the API tokens created on a project's
// Collaborators page — linked from there, and reachable without signing
// in since a token itself is the credential, not a session.
export default function ApiDocs() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo compact />
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-16">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">API</h1>
          <p className="mt-1 text-sm text-ink-tertiary">
            Every endpoint below is authenticated with a project API token (generate one on a project's
            Collaborators page) via <code className="rounded bg-subtle px-1 py-0.5 text-xs">Authorization: Bearer &lt;token&gt;</code>.
            A token is scoped to exactly one project.
          </p>
        </div>

        <Endpoint
          method="POST"
          path="/api/ci/releases/create"
          description="Publish a new release — the same endpoint CI pipelines use."
          example={`curl -X POST https://your-app/api/ci/releases/create \\
  -H "Authorization: Bearer qap_..." \\
  -F platform=ios -F version=1.2.0 -F bundleId=com.company.app \\
  -F channel=beta -F file=@app.ipa`}
        />
        <Endpoint
          method="GET"
          path="/api/v1/releases"
          description="List the project's published releases, newest first (?limit=1-100, default 20)."
          example={`curl https://your-app/api/v1/releases \\
  -H "Authorization: Bearer qap_..."`}
        />
        <Endpoint
          method="GET"
          path="/api/v1/releases/:id"
          description="Fetch a single release's detail."
          example={`curl https://your-app/api/v1/releases/<release-id> \\
  -H "Authorization: Bearer qap_..."`}
        />
      </div>
    </div>
  );
}
