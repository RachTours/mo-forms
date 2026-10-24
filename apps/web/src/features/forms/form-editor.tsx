"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, CalendarDays, ChevronDown, CirclePlus, Copy, Eye, Grip, MessageSquare, MoveVertical, Plus, Save, Send, Trash2 } from "lucide-react";
import { formDefinitionSchema, formDefinitionWriteSchema, type FormDefinition, type FormField } from "@reviewroom/contracts/forms";
import { useApi } from "../../lib/client-api";
import { duplicateField, moveField, moveFieldTo, persistForm } from "./form-editor-actions";
import { fieldPalette as palette, makeField } from "./form-editor-model";
import { useWorkspaceSession } from "../../components/workspace-shell";
import { withSessionSelector } from "../../lib/session-url";

type FormRecord = { id: string; title: string; description: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; draftDefinition: unknown; currentPublishedId: string | null };
type ActionFeedback = { phase: "idle" | "pending" | "success" | "error"; message: string };
function getRatingPreviewValues(field: Extract<FormField, { type: "rating" }>): number[] | null {
  const count = (field.max - field.min) / field.step + 1;
  if (!Number.isSafeInteger(count) || count < 1 || count > 21) return null;
  return Array.from({ length: count }, (_, index) => field.min + index * field.step);
}

export function FormEditor({ initial }: { initial: FormRecord }) {
  const router = useRouter();
  const api = useApi();
  const session = useWorkspaceSession();
  const initialDefinition = formDefinitionSchema.safeParse(initial.draftDefinition);
  const [definition, setDefinition] = useState<FormDefinition>(initialDefinition.success ? initialDefinition.data : { title: initial.title, description: initial.description, fields: [] });
  const [selected, setSelected] = useState<string | null>(definition.fields[0]?.id ?? null);
  const [status, setStatus] = useState(initial.status);
  const [draftFeedback, setDraftFeedback] = useState<ActionFeedback>({ phase: "idle", message: "Save draft to keep your latest changes." });
  const [publishFeedback, setPublishFeedback] = useState<ActionFeedback>(initial.status === "PUBLISHED" ? { phase: "success", message: "Published version is live." } : { phase: "idle", message: "Not published yet." });
  const [busy, setBusy] = useState(false);
  const current = useMemo(() => definition.fields.find((field) => field.id === selected) ?? null, [definition.fields, selected]);
  function updateField(id: string, patch: Partial<FormField>) { setDefinition((value) => ({ ...value, fields: value.fields.map((field) => field.id === id ? { ...field, ...patch } as FormField : field) })); }
  function reorderField(id: string, direction: -1 | 1) { setDefinition((value) => ({ ...value, fields: moveField(value.fields, id, direction) })); }
  function dropField(id: string, targetId: string) { setDefinition((value) => ({ ...value, fields: moveFieldTo(value.fields, id, targetId) })); }
  function duplicateQuestion(field: FormField, index: number) { const copy = duplicateField(field); setDefinition((value) => ({ ...value, fields: [...value.fields.slice(0, index + 1), copy, ...value.fields.slice(index + 1)] })); setSelected(copy.id); }
  function addField(type: FormField["type"]) { const field = makeField(type); setDefinition((value) => ({ ...value, fields: [...value.fields, field] })); setSelected(field.id); }
  async function save(publish = false) {
    const checked = formDefinitionWriteSchema.safeParse(definition);
    if (!checked.success) {
      const message = checked.error.issues[0]?.message ?? "Check the form fields.";
      setDraftFeedback({ phase: "error", message });
      if (publish) setPublishFeedback({ phase: "error", message: "Not published. Fix the form validation errors first." });
      return;
    }

    setBusy(true);
    setDraftFeedback({ phase: "pending", message: "Saving draft…" });
    if (publish) setPublishFeedback({ phase: "pending", message: "Publishing…" });
    try {
      const result = await persistForm(
        () => api(`/forms/${initial.id}`, { method: "PATCH", body: JSON.stringify(checked.data) }),
        () => api(`/forms/${initial.id}/publish`, { method: "POST" }),
        publish,
      );
      if (result.kind === "saved") setDraftFeedback({ phase: "success", message: "Draft saved successfully." });
      if (result.kind === "published") {
        setStatus("PUBLISHED");
        setDraftFeedback({ phase: "success", message: "Draft saved successfully." });
        setPublishFeedback({ phase: "success", message: "Published successfully. New reviews use this version." });
      }
      if (result.kind === "failed" && result.stage === "save") {
        setDraftFeedback({ phase: "error", message: result.message });
        if (publish) setPublishFeedback({ phase: "error", message: `Not published because the draft could not be saved: ${result.message}` });
      }
      if (result.kind === "failed" && result.stage === "publish") {
        setDraftFeedback({ phase: "success", message: "Draft saved successfully." });
        setPublishFeedback({ phase: "error", message: `Draft saved, but publishing failed: ${result.message}` });
      }
    } finally {
      setBusy(false);
    }
  }
  async function archive() { if (!window.confirm("Archive this form? Existing submissions will remain available.")) return; setBusy(true); try { await api(`/forms/${initial.id}`, { method: "DELETE" }); router.push(withSessionSelector("/admin/forms", session.sessionId)); } catch (error) { setDraftFeedback({ phase: "error", message: error instanceof Error ? error.message : "Could not archive the form." }); setBusy(false); } }
  async function permanentlyDelete() {
    if (window.prompt(`Permanently delete “${definition.title}” and its published versions and share links? Type the form title to confirm.`) !== definition.title) return;
    setBusy(true);
    try { await api(`/forms/${initial.id}/permanent`, { method: "DELETE" }); router.push(withSessionSelector("/admin/forms", session.sessionId)); }
    catch (error) { setDraftFeedback({ phase: "error", message: error instanceof Error ? error.message : "Could not permanently delete the form." }); setBusy(false); }
  }
  function updateOption(field: FormField, optionId: string, label: string) { if (!("options" in field)) return; updateField(field.id, { options: field.options.map((option) => option.id === optionId ? { ...option, label } : option) } as Partial<FormField>); }
  function addOption(field: FormField) { if (!("options" in field)) return; updateField(field.id, { options: [...field.options, { id: crypto.randomUUID(), label: `Option ${field.options.length + 1}` }] } as Partial<FormField>); }
  function moveOption(field: FormField, index: number, direction: -1 | 1) { if (!("options" in field)) return; const options = [...field.options]; const target = index + direction; if (target < 0 || target >= options.length) return; [options[index], options[target]] = [options[target]!, options[index]!]; updateField(field.id, { options } as Partial<FormField>); }
  function removeOption(field: FormField, id: string) { if (!("options" in field)) return; updateField(field.id, { options: field.options.filter((option) => option.id !== id) } as Partial<FormField>); }
  function renderPreview(field: FormField) {
    if (field.type === "heading") return <div className="section-preview"><h3>{field.label}</h3>{field.description && <p>{field.description}</p>}</div>;
    if (field.type === "singleChoice") return <div className="option-preview">{field.options.map((option) => <div className="option-line" key={option.id}><span className="radio-indicator" />{option.label}</div>)}</div>;
    if (field.type === "checkboxes") return <div className="option-preview">{field.options.map((option) => <div className="option-line" key={option.id}><span className="checkbox-indicator" />{option.label}</div>)}</div>;
    if (field.type === "dropdown") return <div className="preview-input preview-select"><span>Choose an option</span><ChevronDown size={15} /></div>;
    if (field.type === "yesNo") return <div className="option-preview"><div className="option-line"><span className="radio-indicator" />Yes</div><div className="option-line"><span className="radio-indicator" />No</div></div>;
    if (field.type === "rating") {
      const values = getRatingPreviewValues(field);
      return <div className="rating-preview-wrap">{values ? <div className="rating-preview" aria-label={`Rating from ${field.min} to ${field.max} in steps of ${field.step}`}>{values.map((value) => <span key={value}>{value}</span>)}</div> : <div className="preview-input">Rating from {field.min} to {field.max} by {field.step}</div>}<div className="scale-ends"><span>{field.min} · Lowest</span><span>{field.max} · Highest</span></div></div>;
    }
    if (field.type === "date") return <div className="preview-input preview-select"><span>Select a date</span><CalendarDays size={15} /></div>;
    if (field.type === "consent") return <div className="option-line"><span className="checkbox-indicator" />{field.consentText}</div>;
    if (field.type === "ranking") return <div className="rank-list"><small className="ranking-direction">{field.direction}</small>{field.options.map((option, optionIndex) => <div className="rank-option" key={option.id}><MoveVertical size={14} />{option.label}<span className="rank-controls"><button type="button" aria-label={`Move ${option.label} up`} onClick={(event) => { event.stopPropagation(); moveOption(field, optionIndex, -1); }} disabled={optionIndex === 0}><ArrowUp size={12} /></button><button type="button" aria-label={`Move ${option.label} down`} onClick={(event) => { event.stopPropagation(); moveOption(field, optionIndex, 1); }} disabled={optionIndex === field.options.length - 1}><ArrowDown size={12} /></button></span></div>)}</div>;
    if (field.type === "signature") return <div className="signature-preview"><span>Draw or type your signature</span><span className="signature-preview-line" /></div>;
    if (field.type === "longText") return <div className="preview-input preview-textarea" />;
    const placeholder = field.type === "email" ? "name@example.com" : field.type === "url" ? "https://example.com" : field.type === "phone" ? "+1 555 123 4567" : field.type === "name" ? "Enter a full name" : "Your answer";
    return <div className="preview-input">{placeholder}</div>;
  }

  return <div className="page-content editor-content"><div className="editor-toolbar"><Link href="/admin/forms" className="icon-button" aria-label="Back to forms"><ArrowLeft size={16} /></Link><div className="editor-title"><span className="eyebrow">FORM STUDIO</span><strong>{definition.title || "Untitled form"}</strong><small>{status === "PUBLISHED" ? "Published version · draft can be edited" : "Draft · only published forms collect responses"}</small></div><div className="button-row"><div className="editor-feedback" aria-live="polite" aria-atomic="true"><span className={`save-state feedback-${draftFeedback.phase}`}><span>Draft</span>{draftFeedback.message}</span><span className={`save-state feedback-${publishFeedback.phase}`}><span>Publish</span>{publishFeedback.message}</span></div><button className="button" onClick={() => void save()} disabled={busy}><Save size={14} /> {busy && draftFeedback.phase === "pending" ? "Saving…" : "Save draft"}</button><button className="button button-primary" onClick={() => void save(true)} disabled={busy || definition.fields.length === 0}><Send size={14} /> {publishFeedback.phase === "pending" ? "Publishing…" : "Publish"}</button><button className="icon-button archive-action" type="button" aria-label="Archive form" title="Archive form" onClick={() => void archive()} disabled={busy}><Archive size={15} /></button><button className="icon-button danger-action" type="button" aria-label="Permanently delete form" title="Permanently delete form" onClick={() => void permanentlyDelete()} disabled={busy}><Trash2 size={15} /></button></div></div>
    <div className="editor-title-inputs"><input aria-label="Form title" value={definition.title} maxLength={160} onChange={(event) => setDefinition({ ...definition, title: event.target.value })} /><textarea aria-label="Form description" value={definition.description} maxLength={2000} onChange={(event) => setDefinition({ ...definition, description: event.target.value })} placeholder="Description shown to reviewers" rows={2} /></div>
    <div className="builder-grid"><aside className="builder-panel"><h2>Add to your form</h2>{[{ label: "Structure", fields: palette.filter((item) => item.type === "heading") }, { label: "Answer fields", fields: palette.filter((item) => item.type !== "heading") }].map((group) => <div className="palette-group" key={group.label}><span className="palette-group-title">{group.label}</span><div className="field-palette">{group.fields.map((item) => <button className="field-button" key={item.type} onClick={() => addField(item.type)} type="button"><CirclePlus size={12} />{item.label}</button>)}</div></div>)}<div className="palette-note">Choose a block, then edit its wording and settings. Select any block in the preview to edit it.</div></aside>
      <section className="builder-panel canvas-panel"><div className="canvas-toolbar"><span><Eye size={14} /> Live form preview</span><span>{definition.fields.length} {definition.fields.length === 1 ? "question" : "questions"}</span></div><div className="form-canvas"><div className="form-sheet"><span className="form-preview-tag">REVIEW FORM</span><h2>{definition.title || "Untitled form"}</h2><p>{definition.description || "Your introduction will appear here."}</p>{definition.fields.length === 0 ? <div className="canvas-empty"><CirclePlus size={19} /><strong>Add the first question</strong><span>Choose a question type from the left.</span></div> : definition.fields.map((field, index) => <article className={`form-field ${selected === field.id ? "form-field-selected" : ""}`} key={field.id} tabIndex={0} aria-label={"Select " + field.label + " field"} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(field.id); } }} draggable onClick={() => setSelected(field.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", field.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedId = event.dataTransfer.getData("text/plain"); if (draggedId) dropField(draggedId, field.id); }}><div className="field-actions"><span title="Drag to reorder"><Grip size={13} /> {palette.find((item) => item.type === field.type)?.label}</span><span><button type="button" aria-label="Move question up" onClick={(event) => { event.stopPropagation(); reorderField(field.id, -1); }} disabled={index === 0}><ArrowUp size={13} /></button><button type="button" aria-label="Move question down" onClick={(event) => { event.stopPropagation(); reorderField(field.id, 1); }} disabled={index === definition.fields.length - 1}><ArrowDown size={13} /></button><button type="button" aria-label={`Duplicate question: ${field.label}`} onClick={(event) => { event.stopPropagation(); duplicateQuestion(field, index); }}><Copy size={13} /></button><button type="button" aria-label={`Delete question: ${field.label}`} onClick={(event) => { event.stopPropagation(); setDefinition({ ...definition, fields: definition.fields.filter((candidate) => candidate.id !== field.id) }); setSelected(null); }}><Trash2 size={13} /></button></span></div>{field.type === "heading" ? renderPreview(field) : <>
<label>{field.label}{field.required && <em>Required</em>}</label>{field.description && <small className="field-help">{field.description}</small>}{renderPreview(field)}
</>}</article>)}<div className="preview-submit">Submit review <span>Responses are saved securely</span></div></div></div></section>
      <aside className="builder-panel property-panel"><h2>Question settings</h2>{current ? <div className="settings-panel"><label htmlFor="question-label">{current.type === "heading" ? "Heading" : "Question"}</label><input id="question-label" value={current.label} maxLength={160} onChange={(event) => updateField(current.id, { label: event.target.value })} /><label htmlFor="question-help">Description</label><textarea id="question-help" rows={3} maxLength={500} value={current.description} onChange={(event) => updateField(current.id, { description: event.target.value })} />{current.type !== "heading" && <label className="switch-row"><span>Required</span><input className="switch" type="checkbox" checked={current.required} onChange={(event) => updateField(current.id, { required: event.target.checked })} /></label>}{"options" in current && <><div className="setting-subhead">Answer options</div>{current.options.map((option, index) => <div className="option-editor" key={option.id}><input aria-label={`Option ${index + 1}`} value={option.label} maxLength={120} onChange={(event) => updateOption(current, option.id, event.target.value)} /><button className="icon-button" aria-label={`Remove ${option.label}`} onClick={() => removeOption(current, option.id)} type="button"><Trash2 size={13} /></button></div>)}<button className="text-button" type="button" onClick={() => addOption(current)}><Plus size={13} /> Add option</button></>}{current.type === "ranking" && <><label htmlFor="ranking-direction">Ranking instruction</label><input id="ranking-direction" maxLength={240} value={current.direction} onChange={(event) => updateField(current.id, { direction: event.target.value } as Partial<FormField>)} /><p className="help-copy">Reviewers arrange choices in order using arrows. No numeric ranks are shown.</p></>}{(current.type === "name" || current.type === "shortText" || current.type === "longText") && <div className="property-columns"><div><label htmlFor="min-length">Minimum characters</label><input id="min-length" type="number" min={0} max={current.type === "name" ? 160 : current.type === "shortText" ? 5000 : 20000} value={current.minLength ?? ""} onChange={(event) => updateField(current.id, { minLength: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div><div><label htmlFor="max-length">Maximum characters</label><input id="max-length" type="number" min={1} max={current.type === "name" ? 160 : current.type === "shortText" ? 5000 : 20000} value={current.maxLength ?? ""} onChange={(event) => updateField(current.id, { maxLength: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div></div>}
{current.type === "number" && <div className="property-columns"><div><label htmlFor="number-min">Minimum value</label><input id="number-min" type="number" value={current.min ?? ""} onChange={(event) => updateField(current.id, { min: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div><div><label htmlFor="number-max">Maximum value</label><input id="number-max" type="number" value={current.max ?? ""} onChange={(event) => updateField(current.id, { max: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div></div>}
{current.type === "checkboxes" && <div className="property-columns"><div><label htmlFor="checkbox-min">Minimum selections</label><input id="checkbox-min" type="number" min={0} max={current.options.length} value={current.minSelections ?? ""} onChange={(event) => updateField(current.id, { minSelections: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div><div><label htmlFor="checkbox-max">Maximum selections</label><input id="checkbox-max" type="number" min={1} max={current.options.length} value={current.maxSelections ?? ""} onChange={(event) => updateField(current.id, { maxSelections: event.target.value ? Number(event.target.value) : undefined } as Partial<FormField>)} /></div></div>}
{current.type === "rating" && <div className="property-columns"><div><label htmlFor="rating-min">Minimum value</label><input id="rating-min" type="number" value={current.min} onChange={(event) => updateField(current.id, { min: Number(event.target.value) } as Partial<FormField>)} /></div><div><label htmlFor="rating-max">Maximum value</label><input id="rating-max" type="number" value={current.max} onChange={(event) => updateField(current.id, { max: Number(event.target.value) } as Partial<FormField>)} /></div><div><label htmlFor="rating-step">Step size</label><input id="rating-step" type="number" min={1} value={current.step} onChange={(event) => updateField(current.id, { step: Number(event.target.value) } as Partial<FormField>)} /></div></div>}
{current.type === "date" && <div className="property-columns"><div><label htmlFor="date-min">Earliest date</label><input id="date-min" type="date" value={current.minDate ?? ""} onChange={(event) => updateField(current.id, { minDate: event.target.value || undefined } as Partial<FormField>)} /></div><div><label htmlFor="date-max">Latest date</label><input id="date-max" type="date" value={current.maxDate ?? ""} onChange={(event) => updateField(current.id, { maxDate: event.target.value || undefined } as Partial<FormField>)} /></div></div>}{current.type === "consent" && <><label htmlFor="consent-text">Consent statement</label><textarea id="consent-text" rows={3} value={current.consentText} onChange={(event) => updateField(current.id, { consentText: event.target.value } as Partial<FormField>)} /></>}</div> : <div className="properties-empty"><MessageSquare size={18} /><strong>Select a question</strong><span>Field controls will appear here.</span></div>}</aside></div>
  </div>;
}
