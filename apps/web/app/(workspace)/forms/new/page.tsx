"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "../../../../src/lib/client-api";
import { useWorkspaceSession } from "../../../../src/components/workspace-shell";
import { withSessionSelector } from "../../../../src/lib/session-url";

export default function NewFormPage() {
  const api = useApi(); const router = useRouter(); const session = useWorkspaceSession(); const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function create(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { const result = await api<{ data: { id: string } }>("/forms", { method: "POST", body: JSON.stringify({ title, description }) }); router.replace(withSessionSelector(`/admin/forms/${result.data.id}`, session.sessionId)); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create the form."); setBusy(false); } }
  return <div className="page-content narrow-content"><div className="page-heading"><div><p className="eyebrow">FORM STUDIO · NEW</p><h1>Create a form</h1><p>Give your review form a name. You can add questions next.</p></div></div><form className="panel settings-panel form-create" onSubmit={create}><label htmlFor="title">Form name</label><input id="title" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Peer review" /><label htmlFor="description">Description</label><textarea id="description" maxLength={2000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell reviewers what this form is for." />{error && <p className="form-error" role="alert">{error}</p>}<div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? "Creating…" : "Create and edit"}</button><button className="button" type="button" onClick={() => router.push(withSessionSelector("/admin/forms", session.sessionId))}>Cancel</button></div></form></div>;
}
