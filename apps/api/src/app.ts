import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env, trustedProxies } from "./env.js";
import { errorHandler, notFound } from "./http/error-handler.js";
import { apiRateLimit } from "./http/rate-limits.js";
import { requestContext } from "./http/request-context.js";
import { noStore } from "./http/no-store.js";
import { isDraining } from "./http/service-state.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { prisma } from "./db/client.js";
import { formRouter } from "./modules/forms/form.routes.js";
import { progressRouter } from "./modules/progress/progress.routes.js";
import { reviewLinkRouter } from "./modules/links/review-link.routes.js";
import { memberRouter } from "./modules/members/member.routes.js";
import { publicReviewRouter } from "./modules/submissions/public-review.routes.js";
import { targetRouter } from "./modules/targets/target.routes.js";
import { submissionRouter } from "./modules/submissions/submission.routes.js";
import { auditRouter } from "./modules/audit/audit.routes.js";
import { organizationRouter } from "./modules/organization/organization.routes.js";
import { assignmentRouter } from "./modules/assignments/assignment.routes.js";

export const app = express();

app.disable("x-powered-by");
// Hostinger forwards requests through one managed reverse-proxy hop. Trust only
// that hop by default; explicit trusted proxy addresses can still override it.
app.set("trust proxy", trustedProxies.length > 0 ? trustedProxies : 1);
app.use(requestContext);
app.use("/api/v1", noStore);
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], allowedHeaders: ["Content-Type", "X-Request-Id", "X-CSRF-Token", "X-Reviewroom-Audience", "X-Reviewroom-Session-Id"] }));
app.use(express.json({ limit: "64kb", strict: true }));
app.use(cookieParser());
app.use("/api/v1", apiRateLimit);

app.get("/health", noStore, (_request, response) => response.status(200).json({ status: "ok" }));
app.get("/api/v1/health/live", (_request, response) => response.status(200).json({ status: "ok" }));
app.get("/api/v1/health/ready", async (_request, response, next) => {
  if (isDraining()) {
    response.status(503).json({ status: "draining" });
    return;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({ status: "ready" });
  } catch (error) { next(error); }
});
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/forms", formRouter);
app.use("/api/v1/progress", progressRouter);
app.use("/api/v1/members", memberRouter);
app.use("/api/v1/review-links", reviewLinkRouter);
app.use("/api/v1/public/review", publicReviewRouter);
app.use("/api/v1/review-targets", targetRouter);
app.use("/api/v1/assignments", assignmentRouter);
app.use("/api/v1/submissions", submissionRouter);
app.use("/api/v1/audit-events", auditRouter);
app.use("/api/v1/organization", organizationRouter);

app.use(notFound);
app.use(errorHandler);
