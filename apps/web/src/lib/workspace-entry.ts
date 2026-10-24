import { redirect } from "next/navigation";
import { sessionResponseSchema } from "@reviewroom/contracts";
import { serverApi } from "./api";
import { signInPathForRole, workspaceEntryPath, type Audience } from "./workspace-access";
import { withSessionSelector } from "./session-url";

export async function routeWorkspaceEntry(audience: Audience): Promise<never> {
  let response: Response;
  try { response = await serverApi("/auth/session"); }
  catch { redirect(`${signInPathForRole(audience)}?reason=service-unavailable`); }
  if (!response.ok) redirect(signInPathForRole(audience));
  const session = sessionResponseSchema.safeParse(await response.json());
  if (!session.success) redirect(`${signInPathForRole(audience)}?reason=session-invalid`);
  const destination = workspaceEntryPath(audience, session.data.role);
  if (destination === signInPathForRole(audience)) redirect(`${destination}?reason=wrong-workspace`);
  redirect(destination === signInPathForRole(audience) ? destination : withSessionSelector(destination, session.data.sessionId));
}
