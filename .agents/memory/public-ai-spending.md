---
name: Public AI spending
description: Cost-control invariants for the public Schedule AI surface.
---
Preserve admission for the entire logical request, including dependent model calls, and retain uncertain charges instead of guessing what was billed.

**Why:** A separate quota check before a later call can stop the request after it has already spent money. Timeouts, crashes, and ambiguous database responses are not proof that an upstream charge did not happen.

**How to apply:** Reevaluate worst-case reservations when adding calls or changing providers. Only release capacity backed by verified usage or calls that were never attempted. Do not treat anonymous network limits as a substitute for the shared spend limit.
