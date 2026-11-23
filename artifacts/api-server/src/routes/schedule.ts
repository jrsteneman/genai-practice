import { Router, type IRouter, type Response } from "express";
import {
  AnalyzeScheduleBody,
  AnalyzeScheduleResponse,
  AskScheduleBody,
  AskScheduleResponse,
} from "@workspace/api-zod";
import { analyzeWithModel, answerWithModel } from "../lib/schedule-ai";
import {
  ScheduleAiLimitReached,
  ScheduleModelUnavailable,
} from "../lib/schedule-ai-budget";

const router: IRouter = Router();
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

router.post("/schedule/analyze", async (req, res): Promise<void> => {
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
      AnalyzeScheduleResponse.parse(
        await analyzeWithModel(parsed.data, req.ip),
      ),
    );
  } catch (e) {
    scheduleError(res, e);
  }
});
router.post("/schedule/question", async (req, res): Promise<void> => {
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
        ),
      ),
    );
  } catch (e) {
    scheduleError(res, e);
  }
});
export default router;
