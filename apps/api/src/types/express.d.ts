import type { Role } from "@reviewroom/contracts";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sessionId: string;
        userId: string;
        organizationId: string;
        organizationName: string;
        membershipId: string;
        role: Role;
        email: string;
        displayName: string;
      };
      csrfToken?: string;
      authCookieName?: string;
      authSessionSelector?: string;
    }
  }
}

export {};
