import { Router, type IRouter } from "express";
import {
  AnalyzeScheduleBody,
  AnalyzeScheduleResponse,
  AskScheduleBody,
  AskScheduleResponse,
} from "@workspace/api-zod";
import {
  analyzeWithModel,
  answerWithModel,
  ScheduleModelUnavailable,
} from "../lib/schedule-ai";

const router: IRouter = Router();
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
      AnalyzeScheduleResponse.parse(await analyzeWithModel(parsed.data)),
    );
  } catch (e) {
    res
      .status(e instanceof ScheduleModelUnavailable ? 503 : 400)
      .json({ error: e instanceof Error ? e.message : "Invalid schedule." });
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
        ),
      ),
    );
  } catch (e) {
    res
      .status(e instanceof ScheduleModelUnavailable ? 503 : 400)
      .json({ error: e instanceof Error ? e.message : "Invalid schedule." });
  }
});
export default router;
