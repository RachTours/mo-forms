"use client";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useApi } from "../../lib/client-api";
import { formatDate } from "../../lib/date-format";
import { getDirectOpenLinkProps } from "./my-review-link-model";

type FormLink = { id: string; createdAt: string; expiresAt: string | null; revokedAt: string | null; active: boolean; canReveal?: boolean };
type PublishedForm = { id: string; title: string; description: string; link: FormLink | null };

export function MyReviewLink() {
  const api = useApi();
  const [forms, setForms] = useState<PublishedForm[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    void api<{ data: PublishedForm[] }>("/review-links/mine/forms").then((result) => { if (live) setForms(result.data); })
      .catch((caught: unknown) => { if (live) setError(caught instanceof Error ? caught.message : "Published forms could not load."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api]);

  async function issue(form: PublishedForm) {
    const replacing = !!form.link?.active;
    if (replacing && !window.confirm(`Replace your link for “${form.title}”? The current link will stop working.`)) return;
    setBusyId(form.id); setError(""); setNotice("");
    try {
      const result = await api<{ data: FormLink & { shareUrl: string } }>(`/review-links/mine/forms/${form.id}/rotate`, { method: "POST" });
      setForms((rows) => rows.map((row) => row.id === form.id ? { ...row, link: { ...result.data, active: true, revokedAt: null } } : row));
      setUrls((current) => ({ ...current, [form.id]: result.data.shareUrl }));
      setNotice(`Share link ready for ${form.title}. Copy it now; the full URL is shown only once.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The form link could not be created."); }
    finally { setBusyId(""); }
  }

  async function revoke(form: PublishedForm) {
    if (!form.link) return;
    if (!window.confirm(`Revoke your link for “${form.title}”? Anyone using it will lose access.`)) return;
    setBusyId(form.id); setError(""); setNotice("");
    try {
      await api(`/review-links/${form.link.id}/revoke`, { method: "POST" });
      setForms((rows) => rows.map((row) => row.id === form.id && row.link ? { ...row, link: { ...row.link, active: false, revokedAt: new Date().toISOString() } } : row));
      setUrls((current) => { const next = { ...current }; delete next[form.id]; return next; });
      setNotice(`Link revoked for ${form.title}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The form link could not be revoked."); }
    finally { setBusyId(""); }
  }

  async function copy(formId: string) {
    setError(""); setNotice("");
    let shareUrl = urls[formId];
    if (!shareUrl) {
      setBusyId(formId);
      try {
        const result = await api<{ data: { shareUrl: string } }>(`/review-links/mine/forms/${formId}/reveal`, { method: "POST" });
        shareUrl = result.data.shareUrl;
        setUrls((current) => ({ ...current, [formId]: shareUrl! }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The form link could not be loaded.");
        setBusyId("");
        return;
      } finally { setBusyId(""); }
    }
    try { await navigator.clipboard.writeText(shareUrl); setNotice("Form link copied."); }
    catch { setNotice("Your active link is ready below. Select it and copy it manually."); }
  }

  return <>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="form-success">{notice}</p>}
    {loading ? <div className="panel empty-inline">Loading published forms…</div> : error && forms.length === 0 ? null : forms.length === 0 ? <section className="panel personal-link-card"><span className="personal-link-icon"><Link2 size={20} /></span><h2>No published forms yet</h2><p>When an admin publishes a form, it will appear here. You can then create a link tied to your reviewer account and assigned targets.</p></section> : <div className="personal-form-links">{forms.map((form) => <section className="panel personal-link-card" key={form.id}>
      <span className="personal-link-icon"><Link2 size={20} /></span><h2>{form.title}</h2>{form.description && <p>{form.description}</p>}
      {form.link?.active ? <div className="personal-link-meta"><span><ShieldCheck size={14} /> Active · reviewer-specific</span><span>Expires {form.link.expiresAt ? formatDate(form.link.expiresAt) : "never"}</span></div> : <p className="muted-caption">{form.link ? "Link revoked or expired" : "No share link created yet"}</p>}
      <div className="button-row"><button className="button button-primary" disabled={!!busyId} onClick={() => void issue(form)}><RefreshCw size={14} /> {busyId === form.id ? "Working…" : form.link?.active ? "Rotate link" : "Create link"}</button>{form.link?.active && form.link.canReveal && <button className="button button-small" disabled={!!busyId} onClick={() => void copy(form.id)}><Copy size={13} /> {busyId === form.id ? "Loading…" : "Copy link"}</button>}{urls[form.id] && <a {...getDirectOpenLinkProps(urls[form.id]!)} className="button button-small icon-button" aria-label={`Open ${form.title} form in a new tab`} title="Open form in a new tab"><ExternalLink size={14} /></a>}{form.link?.active && <button className="button" disabled={!!busyId} onClick={() => void revoke(form)}><X size={14} /> Revoke</button>}{urls[form.id] && !form.link?.canReveal && <button className="button button-small" onClick={() => void copy(form.id)}><Copy size={13} /> Copy link</button>}</div>
      {urls[form.id] && <div className="one-time-secret"><strong>Your active form link</strong><small>This link opens only this form and only reviews assigned to your account. Copying it does not change or rotate the link.</small><div><input readOnly value={urls[form.id]} aria-label={`${form.title} share link`} /><button className="button button-small" onClick={() => void copy(form.id)}><Copy size={13} /> Copy</button><a {...getDirectOpenLinkProps(urls[form.id]!)} className="button button-small icon-button" aria-label={`Open ${form.title} form in a new tab`} title="Open form in a new tab"><ExternalLink size={14} /></a></div></div>}
    </section>)}</div>}
    <div className="personal-link-note"><ShieldCheck size={16} /><p>Each link is tied to one published form and your reviewer account. You can revoke or replace your links at any time.</p></div>
  </>;
}
