import { Router, type IRouter } from "express";
import {
  AnalyzeScheduleBody,
  AnalyzeScheduleResponse,
  AskScheduleBody,
  AskScheduleResponse,
} from "@workspace/api-zod";
import { analyze, answer } from "../lib/schedule";

const router: IRouter = Router();
// No provider calls: AI is explicitly deferred. Requests are bounded by JSON
// size, schema limits, and deterministic work over at most 100 tasks.
router.post("/schedule/analyze", (req, res): void => {
  const parsed = AnalyzeScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        error:
          "Invalid analysis input: " +
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
      });
    return;
  }
  try {
    res.json(AnalyzeScheduleResponse.parse(analyze(parsed.data)));
  } catch (e) {
    res
      .status(400)
      .json({ error: e instanceof Error ? e.message : "Invalid schedule." });
  }
});
router.post("/schedule/question", (req, res): void => {
  const parsed = AskScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        error:
          "Invalid question input. Provide a bounded question and valid schedule context.",
      });
    return;
  }
  try {
    res.json(
      AskScheduleResponse.parse(
        answer(parsed.data.context, parsed.data.question),
      ),
    );
  } catch (e) {
    res
      .status(400)
      .json({ error: e instanceof Error ? e.message : "Invalid schedule." });
  }
});
export default router;
