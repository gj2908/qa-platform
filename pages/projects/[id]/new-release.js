import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { createServerSupabase } from "../../../lib/supabase/server";

export async function getServerSideProps({ params, req, res }) {
  const supabase = createServerSupabase(req, res);
  const { data: project } = await supabase.from("projects").select("*").eq("id", params.id).single();
  if (!project) return { notFound: true };
  return { props: { project } };
}

export default function NewRelease({ project }) {
  const router = useRouter();
  const [platform, setPlatform] = useState("ios");
  const [version, setVersion] = useState("");
  const [buildNumber, setBuildNumber] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      let filePath = null;

      if (platform !== "web") {
        if (!file) {
          throw new Error("Please choose a build file");
        }
        const signRes = await fetch("/api/releases/sign-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, platform, filename: file.name }),
        });
        const signData = await signRes.json();
        if (!signRes.ok) throw new Error(signData.error || "Could not start upload");

        const putRes = await fetch(signData.uploadUrl, { method: "PUT", body: file });
        if (!putRes.ok) throw new Error("Upload to storage failed");

        filePath = signData.filePath;
      }

      const formData = new FormData();
      formData.append("projectId", project.id);
      formData.append("platform", platform);
      formData.append("version", version);
      formData.append("buildNumber", buildNumber);
      formData.append("bundleId", bundleId);
      formData.append("notes", notes);
      if (platform === "web") formData.append("webUrl", webUrl);
      if (filePath) formData.append("filePath", filePath);

      const res = await fetch("/api/releases/create", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      router.push(`/distribute/${data.releaseId}`);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: "0 20px" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/projects/${project.id}/changelog`}>← Changelog</Link>
      </div>
      <h1>New release — {project.name}</h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          Platform
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
            <option value="ios">iOS (.ipa)</option>
            <option value="android">Android (.apk / .aab)</option>
            <option value="web">Web app (link)</option>
          </select>
        </label>

        <label>
          Version
          <input required value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.2.0" style={inputStyle} />
        </label>

        <label>
          Build number (optional)
          <input value={buildNumber} onChange={(e) => setBuildNumber(e.target.value)} style={inputStyle} />
        </label>

        {platform === "ios" && (
          <label>
            Bundle ID (required for iOS install)
            <input
              required
              value={bundleId}
              onChange={(e) => setBundleId(e.target.value)}
              placeholder="com.yourcompany.app"
              style={inputStyle}
            />
          </label>
        )}

        {platform === "web" ? (
          <label>
            App URL
            <input
              required
              type="url"
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              placeholder="https://app.yourcompany.com"
              style={inputStyle}
            />
          </label>
        ) : (
          <label>
            Build file ({platform === "ios" ? ".ipa" : ".apk / .aab"})
            <input
              required
              type="file"
              accept={platform === "ios" ? ".ipa" : ".apk,.aab"}
              onChange={(e) => setFile(e.target.files[0])}
              style={{ marginTop: 4 }}
            />
          </label>
        )}

        <label>
          Release notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="What changed in this release..."
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>

        {error && <p style={{ color: "crimson" }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{ padding: 12, borderRadius: 6, background: "#111", color: "#fff", border: "none" }}
        >
          {submitting ? "Publishing…" : "Publish release"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  marginTop: 4,
  borderRadius: 6,
  border: "1px solid #ccc",
  fontFamily: "inherit",
};
