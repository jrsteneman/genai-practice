---
name: Scheduling authority and AI scope
description: Product rules for deterministic dates, explicit timing, and AI fallback.
---
Keep project-day schedule calculation deterministic, with foreman acceptance before application. AI may interpret disruptions or explain calculated results but must never set authoritative dates or invent crews, substitutions, or safety approval.

**Why:** The user requires trustworthy task, named-milestone, and overall-finish distinctions, not a general construction optimizer. Yearless demo dates cannot establish today's project day.

**How to apply:** Require explicit project-day timing or a visibly confirmed start. Preserve baseline float and use absolute outage windows without double-counting shared equipment. Live AI must be honestly distinguished from fallback.

Use managed GPT-5 mini for language interpretation and schedule Q&A. Keep model unavailability explicit rather than silently substituting a rules result or requesting a personal credential.

**Why:** The user explicitly authorized a deterministic-only delivery if provisioning or live verification was blocked.

**How to apply:** Verify managed provisioning with a live request before claiming live AI. Default to gpt-5-mini without premium escalation; measure real tokens and do not quote credit prices without verifying applicable Replit rates. Treat the model's structured output as a proposed interpretation, not an authoritative schedule change.

Keep working duration distinct from elapsed time across accepted interruptions.

**Why:** Counting accepted outage days as work causes the next analysis to delay the same task again, even when the identical absolute outage is resubmitted.

**How to apply:** Preserve absolute pause windows with accepted task dates. Merge old and new windows, compute finishes using working duration, and test apply-then-reanalyze for both identical and different disruptions.

Treat “cannot start until Day 4” and equivalent explicit availability language as an inclusive earliest start, not an outage through Day 4.

**Why:** The user distinguishes start restrictions from full resource unavailability and interrupted work. A release-day statement must not invent a duration, delay every assignment by four days, or pause work merely because it resumes after the release.

**How to apply:** Restrict planned starts on every assignment of an identified resource, retain working durations and existing absolute interruptions, and clarify ambiguous release language rather than infer an outage.

Ordinary definite start wording, such as “Form crew B starts on Day 3,” means inclusive availability from that day, not a guaranteed exact start.

**Why:** The user expects natural positive start phrases to work without overriding existing later dates or dependencies. An outage's “starting on Day 3” modifier must still describe a full outage window, not become availability.

**How to apply:** Use the same start-not-before meaning as explicit availability. Explain the interpretation visibly; clarify negated, tentative, exact-date, and contradictory wording rather than silently changing its meaning.

Do not narrow an explicit resource outage to a task named as an effect, and do not equate reduced staffing with a complete stoppage.

**Why:** A resource can serve additional scheduled tasks even when the user names just one affected activity; partial crew headcount alone cannot establish lost productivity or a work hold.

**How to apply:** Retain all assignments of explicitly unavailable equipment or an entirely unavailable crew. Clarify mixed task/resource scope when it is not explicit. Ask whether work must stop before modeling a partial staffing shortage.
