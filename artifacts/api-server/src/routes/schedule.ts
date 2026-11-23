import { randomBytes } from "node:crypto";
import cookieParser from "cookie-parser";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  AnalyzeScheduleBody,
  AskScheduleBody,
  AskScheduleResponse,
} from "@workspace/api-zod";
import { analyzeWithModel, answerWithModel } from "../lib/schedule-ai";
import {
  ScheduleAiLimitReached,
  ScheduleModelUnavailable,
} from "../lib/schedule-ai-budget";

const router: IRouter = Router();
// The analysis cache is process-local, so its cookie needs no persisted key.
// The network IP is used for budgeting only; it is never a cache identity.
const cacheCookies = cookieParser(randomBytes(32).toString("hex"));

function analysisSession(req: Request, res: Response): string {
  const name = req.secure ? "__Host-slipless-ai" : "slipless-ai";
  const existing = req.signedCookies[name];
  if (typeof existing === "string") return existing;
  const session = randomBytes(32).toString("hex");
  res.cookie(name, session, {
    signed: true,
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure,
    path: "/",
  });
  return session;
}

function scheduleError(res: Response, error: unknown) {
  const status =
    error instanceof ScheduleAiLimitReached
      ? 429
      : error instanceof ScheduleModelUnavailable
        ? 503
        : 400;
  res
    .status(status)
    .json({
      error: error instanceof Error ? error.message : "Invalid schedule.",
    });
}

router.post("/schedule/analyze", cacheCookies, async (req, res): Promise<void> => {
  const parsed = AnalyzeScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error:
        "Invalid analysis input: " +
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
    });
    return;
  }
  try {
    res.json(
      await analyzeWithModel(parsed.data, req.ip, analysisSession(req, res)),
    );
  } catch (e) {
    scheduleError(res, e);
  }
});
router.post("/schedule/question", cacheCookies, async (req, res): Promise<void> => {
  const parsed = AskScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error:
        "Invalid question input. Provide a bounded question and valid schedule context.",
    });
    return;
  }
  try {
    res.json(
      AskScheduleResponse.parse(
        await answerWithModel(
          parsed.data.context,
          parsed.data.question,
          parsed.data.recentQuestions,
          req.ip,
          analysisSession(req, res),
        ),
      ),
    );
  } catch (e) {
    scheduleError(res, e);
  }
});
export default router;
