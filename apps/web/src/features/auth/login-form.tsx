"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiErrorSchema, loginRequestSchema, loginResponseSchema, workspaceChoiceResponseSchema } from "@reviewroom/contracts";
import Link from "next/link";
import { PasswordInput } from "./password-input";
import { homePathForRole, roleMatchesAudience, safeWorkspaceReturnPath } from "../../lib/workspace-access";
import { withSessionSelector } from "../../lib/session-url";

export function LoginForm({ audience }: { audience: "admin" | "reviewer" }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; slug: string; role: string }>>([]);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const input = loginRequestSchema.safeParse({ email: form.get("email"), password: form.get("password"), ...(workspaceSlug ? { organizationSlug: workspaceSlug } : {}) });
    if (!input.success) { setError("Enter a valid email address and password."); return; }
    setPending(true);
    try {
      const response = await fetch(`/api/v1/auth/${audience}/login`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const choice = workspaceChoiceResponseSchema.safeParse(body);
        if (response.status === 409 && choice.success) {
          const options = choice.data.data.workspaces;
          if (options.length > 1) { setWorkspaces(options); setWorkspaceSlug(options[0]!.slug); setError("This account belongs to more than one workspace. Choose where to sign in."); return; }
        }
        const parsed = apiErrorSchema.safeParse(body);
        setError(parsed.success ? parsed.data.error.message : "Sign-in failed. Check your details and try again.");
        return;
      }
      const body: unknown = await response.json();
      const session = loginResponseSchema.safeParse(body);
      if (!session.success || !roleMatchesAudience(session.data.role, audience)) {
        setError("Sign-in returned an invalid session. Try again or contact your workspace admin.");
        return;
      }
      const requestedPath = safeWorkspaceReturnPath(new URLSearchParams(window.location.search).get("returnTo"), audience);
      router.replace(withSessionSelector(requestedPath ?? homePathForRole(session.data.role), session.data.sessionId));
      router.refresh();
    } catch {
      setError("The sign-in service could not be reached. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} noValidate>
    {error ? <div className="form-error" role="alert">{error}</div> : null}
    <label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
    <label htmlFor="password">Password</label><PasswordInput id="password" name="password" autoComplete="current-password" />
    {workspaces.length > 1 && <><label htmlFor="workspace">Workspace</label><select id="workspace" value={workspaceSlug} onChange={(event) => setWorkspaceSlug(event.target.value)}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.slug}>{workspace.name} · {workspace.role.toLowerCase()}</option>)}</select></>}
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in securely"}</button>
    <Link className="login-secondary-link" href={`/reset-password?audience=${audience}`}>Forgot password?</Link>
    <p className="login-reset-hint">Use the one-time reset token provided by your workspace admin.</p>
  </form>;
}
