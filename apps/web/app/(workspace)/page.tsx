import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sessionResponseSchema } from "@reviewroom/contracts";
import { serverApi } from "../../src/lib/api";
import { ReviewerProgressBoard } from "../../src/features/progress/reviewer-progress-board";
import { getPeopleRemainingForGoal, getReviewerGoalLabels } from "../../src/features/progress/reviewer-board";
import { roleMatchesAudience, signInPathForRole, workspacePathForRole } from "../../src/lib/workspace-access";
import { withSessionSelector } from "../../src/lib/session-url";

export const metadata: Metadata = { title: "Overview" };
type Summary = { activeTargets: number; assignedTargets: number; completedTargets: number; responseCount: number; unassignedTargets: number; targetCount: number; completionPercent: number; completionRule: string };
type ReviewerRow = { reviewerId: string; displayName: string; assigned: number; completed: number };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const requestHeaders = await headers();
  const requestPath = requestHeaders.get("x-reviewroom-request-path") ?? "/";
  const audience = requestHeaders.get("x-reviewroom-audience") === "reviewer" ? "reviewer" : "admin";
  const selectedSessionId = requestHeaders.get("x-reviewroom-session-id");
  let sessionResponse: Response;
  try { sessionResponse = await serverApi("/auth/session"); } catch { redirect(`${signInPathForRole(audience)}?reason=service-unavailable`); }
  if (!sessionResponse.ok) redirect(signInPathForRole(audience));
  const session = sessionResponseSchema.safeParse(await sessionResponse.json());
  if (!session.success) redirect(`${signInPathForRole(audience)}?reason=session-invalid`);
  if (requestPath === "/") redirect(selectedSessionId ? withSessionSelector(audience === "reviewer" ? "/reviewer/progress" : "/admin/overview", selectedSessionId) : audience === "reviewer" ? "/reviewer/progress" : "/admin/overview");
  if (!roleMatchesAudience(session.data.role, audience)) redirect(`${signInPathForRole(audience)}?reason=wrong-workspace`);
  const reviewer = session.data.role === "REVIEWER";
  let summary: Summary | null = null;
  let reviewers: ReviewerRow[] = [];
  let error = false;
  try {
    const [summaryResponse, boardResponse] = await Promise.all([serverApi("/progress/summary"), reviewer ? Promise.resolve(null) : serverApi("/progress/reviewer-board")]);
    if (!summaryResponse.ok) throw new Error("unavailable");
    const body: { data: Summary } = await summaryResponse.json();
    summary = body.data;
    if (boardResponse?.ok) { const board: { data: ReviewerRow[] } = await boardResponse.json(); reviewers = board.data; }
  } catch { error = true; }
  const query = await searchParams;
  const href = (path: string) => workspacePathForRole(path, session.data.role);
  const reviewerGoalLabels = summary ? getReviewerGoalLabels(summary.completedTargets, summary.targetCount, summary.responseCount) : null;
  const noticeText = query.notice === "admin-only" ? "That page is only available to workspace admins. You are back in your reviewer workspace." : query.notice === "wrong-workspace" ? "That page is not available in your role workspace. You have been returned to your panel." : "";
  if (reviewer) return <div className="page-content">
    {noticeText && <p className="form-success" role="status">{noticeText}</p>}
    <div className="page-heading"><div><p className="eyebrow">YOUR REVIEWER WORKSPACE</p><h1>Your progress</h1><p>Track your assigned reviews and open your personal form links.</p></div><div className="button-row"><Link className="button" href={href("/submissions")}>Submissions</Link><Link className="button button-primary" href={href("/my-link")}>My form links</Link></div></div>
    {error || !summary ? <div className="panel empty-state"><h2>Progress is unavailable</h2><p>Check that the API and database are running, then refresh this page.</p></div> : <>
      <div className="stat-grid reviewer-stat-grid"><article className="stat-card"><label>Assigned to you</label><strong>{summary.assignedTargets}</strong><small>People in your review queue</small></article><article className="stat-card"><label>Completed</label><strong>{summary.completedTargets}</strong><small>Unique people reviewed toward the goal</small></article><article className="stat-card"><label>Submissions</label><strong>{summary.responseCount}</strong><small>Your submitted feedback</small></article></div>
      <section className="progress-panel"><div className="progress-heading"><strong>Your progress toward the workspace goal</strong><span>{summary.completionPercent}%</span></div><div className="progress-track" role="progressbar" aria-label="Your progress toward the workspace review goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.completionPercent}><div className="progress-fill" style={{ width: `${summary.completionPercent}%` }} /></div><div className="progress-foot"><span>{reviewerGoalLabels?.goal}</span><span>{reviewerGoalLabels?.submissions}</span></div><small className="progress-note">{reviewerGoalLabels?.explanation}</small></section>
      <div className="two-columns reviewer-next-steps"><section><div className="section-heading"><h2>Next steps</h2></div><div className="panel"><Link className="panel-row" href={href("/submissions")}><span className="step-dot">↗</span><span className="panel-row-main"><strong>Open your submissions</strong><small>Continue reviewing or check feedback you submitted</small></span></Link><Link className="panel-row" href={href("/my-link")}><span className="step-dot">↗</span><span className="panel-row-main"><strong>Share your form links</strong><small>Your links are tied to your reviewer account and assignments</small></span></Link></div></section></div>
    </>}
  </div>;

  return <div className="page-content">
    <div className="page-heading"><div><p className="eyebrow">YOUR REVIEW WORKSPACE</p><h1>Keep the review moving.</h1><p>A live view of assignments and submitted feedback.</p></div><div className="button-row"><Link className="button" href={href("/people")}>People</Link><Link className="button button-primary" href={href("/team")}>Manage assignments</Link></div></div>
    {error || !summary ? <div className="panel empty-state"><h2>Progress is unavailable</h2><p>Check that the API and database are running, then refresh this page.</p></div> : <>
      <div className="stat-grid"><article className="stat-card"><label>Review goal</label><strong>{summary.targetCount}</strong><small>{summary.activeTargets} people added · {getPeopleRemainingForGoal(summary.targetCount, summary.activeTargets)} still to add</small></article><article className="stat-card"><label>Assignments</label><strong>{summary.assignedTargets}</strong><small>{summary.unassignedTargets} added people waiting for a reviewer</small></article><article className="stat-card"><label>People reviewed</label><strong>{summary.completedTargets}</strong><small>{summary.completionPercent}% of the {summary.targetCount}-person goal</small></article><article className="stat-card"><label>Submissions</label><strong>{summary.responseCount}</strong><small>Feedback entries submitted</small></article></div>
      <section className="progress-panel"><div className="progress-heading"><strong>People reviewed</strong><span>{summary.completionPercent}%</span></div><div className="progress-track" role="progressbar" aria-label="People reviewed toward the workspace goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.completionPercent}><div className="progress-fill" style={{ width: `${summary.completionPercent}%` }} /></div><div className="progress-foot"><span>{summary.completedTargets} of {summary.targetCount} people reviewed</span><span>{summary.assignedTargets} assignments · {summary.unassignedTargets} added people awaiting a reviewer</span></div></section>
      <ReviewerProgressBoard rows={reviewers} targetGoal={summary.targetCount} />
      <div className="two-columns"><section><div className="section-heading"><h2>Next steps</h2><Link className="text-link" href={href("/settings")}>Adjust progress goal</Link></div><div className="panel"><Link className="panel-row" href={href("/team") + "?state=unassigned"}><span className="step-dot">↗</span><span className="panel-row-main"><strong>Assign the remaining people</strong><small>Open reviewer assignments and filter to people still waiting</small></span></Link><Link className="panel-row" href={href("/team")}><span className="step-dot">↗</span><span className="panel-row-main"><strong>Invite your reviewers</strong><small>Give each student their own secure access token</small></span></Link><Link className="panel-row" href={href("/forms")}><span className="step-dot">↗</span><span className="panel-row-main"><strong>Prepare the review form</strong><small>Publish a form before collecting responses</small></span></Link></div></section><section><div className="section-heading"><h2>Workspace controls</h2></div><div className="panel feature-panel"><span className="feature-kicker">CONTROL CENTER</span><h3>One place for the whole review.</h3><p>Manage team access, forms, assignments, progress goals, and submissions from dedicated workspace panels.</p><Link className="button button-small" href={href("/settings")}>Open settings</Link></div></section></div>
    </>}
  </div>;
}
