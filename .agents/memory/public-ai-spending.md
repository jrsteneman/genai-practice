---
name: Public AI spending
description: Cost-control invariants for the public Schedule AI surface.
---
Preserve admission for the entire logical request, including dependent model calls, and retain uncertain charges instead of guessing what was billed.

**Why:** A separate quota check before a later call can stop the request after it has already spent money. Timeouts, crashes, and ambiguous database responses are not proof that an upstream charge did not happen.

**How to apply:** Reevaluate worst-case reservations when adding calls or changing providers. Only release capacity backed by verified usage or calls that were never attempted. Do not treat anonymous network limits as a substitute for the shared spend limit.

Keep browser cache identity separate from network quota identity. Decide which validated facts a request will use before reserving its model calls, and keep that decision fixed for the request.

**Why:** Separate users can share a network, and cache expiry while waiting for quota admission must not add a model call that was never reserved.

**How to apply:** Require a private browser scope and matching complete scheduling context for reuse. Hold both calls on a miss, and on a hit keep the already-validated facts even if the cache entry expires while the budget check runs.
