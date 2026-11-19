This is the repository for SlipLess, a software tool for re-optimizing construction schedules in response to adverse disruptions in labor and equipment on the project.

This first slice takes several pre-generated schedules and allows the user to input plain language disruptions and see the impacts that they have on the schedule.

The site can be accssed at this link: https://construction-schedule-recovery.replit.app

At this moment the AI behavior is simulated: it interprets key words in the input and makes a reasonable guess about what the change should be.

The following is a table indicating the test results for various cases:

| Test | Input or Action | What happened |Pass, Partial, or Fail |
| -------- | -------- | -------- | -------- |
| Typical Case  | "Concrete crew A on the footings and foundation forms team is down three people today, adjust accordingly."   | Produced an expected delay and gave sequence of events to look out for.  |Pass  |
| Challenge Case   | "The tower crane is down, and the concrete crew will be short about five people on work day, reallocate in response to this."   | Gave reallocation plan for the tower crane issue, and seems to have noted the concrete crew shortage but did not clearly give a recommendation there.   | Partial   |
| Invalid Case  | "Make a ham and cheese sandwich."  | Showed an error message to the effect that this input has no schedule connection.   | Pass   |

An important limitation is that the main feature which determines the schedule adjustment is still using a very rudimentary text recognition and solution suggestion mechanism that will be better suited for AI.
Another limitation is the inability to input a custom schedule, since right now it only uses three built-in schedules for the sake of the example, so adding the ability to write or import one would be beneficial.
It also lacks the ability to save any inputted data, which is a lesser priority than the first two but would be nice to have.




## Revision

An attempt at AI functionality was made, but not successfully at this point, further research into integrations for implementing a relatively small language model like gpt-mini must be done in order to accomplish this. As of right now, the intended AI functionality is implemented via a deterministic algorithm, but it is more robust than previously.

| Feedback or observed issue | Decision | What changed, or why it was deferred |
| -------- | -------- | -------- |
|Produced plan does not adjust jobs that depend on certain equipment | Acted on | Tool now explains explicitly what happens to each job and the one mentioned in the change in particular|
|Nonsensical delays based on indicated downtime observed/recommendation steps untraceable to verify | Acted on | Full plan and rationale is now spelled out explicitly so that it can be followed directly and time savings can be verified|
|Deterministic model is overly sensitive to syntax in understanding the problem | Adapted | Some efforts to make it more robust were implemented, and if syntax is not detected advice for how to improve it is given. Will be fixed when language model is implemented|
|Display is overly busy with text| Deferred | New features made the display more busy, and so consolidation will occur later|

|Case|	Input or action	| Expected result / success criterion	| Actual result	| Pass, partial, or fail	| Implication or next step|
| -------- |-------- |-------- |-------- |-------- |-------- |
|Typical 1|"The telehandler is on a two day hold on Days 5-6" |A plan restructuring around the job that can no longer be done on days 4-6 with appropriate delay and reallocation. |Moved North wing framing to be done later on Day 8, delayed roof sheathing, final completion date remains unchanged due to leeway in original plan. |Pass |Fixes issue reviewer found in the first draft, which previously did not clearly indicate that the hold was accounted for, if it was at all. |					
|Typical 2|"Form crew B starts on Day 3" |Pushing that job back to Day 3 and handling everything else accordingly. |Pushed Form crew B's job back to Day 3, pushed everything else that depended on it back 1-2 days depending on what it was, moved overall project back one day. |Pass |Working as intended here. |					
|Challenge|"Mini excavator on hold until Day 3 and Interior crew on hold until Day 5" |Separately handles each issue resolving each dependency and keeping everything straight. |No plan given with error "Use an inclusive project-day window such as Days 4–5 instead of an ambiguous release or end day" |Fail |Multi-step changes still require more work. |	
|Invalid or empty|"Lunch time delayed one hour" |An indication that no tasks are moved |Sometimes indicated no tasks moved, other times gave error indicating task not found. |Partial |Strange behavior should be investigated, but both results are technically acceptable |						
|Risk|"The first form crew starts a day late." |Ambiguous since there are two form crews, but should interpret it as the one on Day 1 and plan accordingly or at least request more info. |Gave error due to lack of explicitly named crew. |Partial |Language model will help this, but at least it does not assume it is referring to form crew A even though that is the wrong one. |		

As of right now, the underlying deterministic recommendation works well as long as the syntax is correct. Any complex requests or wordings slightly outside the norm, however, do not work and produce 
errors. The current value for the user is partly supported by this implementation, then, in that it can recognize slippage inputs and adapt accordingly. The next steps to work on are the non-
deterministic recommendation engine, as well as perhaps the ability to import a schedule.

A risk that may occur with this offering is the recommendation engine may misinterpret the slippage issue given by the user and give a reasonable looking but faulty revised plan. In the current iteration, this is mitigated by giving a detailed overview of the plan and how everything changes for user verification, and having a strict syntax to ensure no misunderstandings and an error system to correct said syntax on the user's end. This prevents the user from simply taking the recommendations at face value and encourages critical judgement. When the project moves to a language model based recommendation engine, though, the model will have to be prompted to maintain this aspect of the recommendation.

## AI Use

Tools used: Replit
Development assistance: Replit produced all of the code, and fixed bugs and security issues following prompting
Representative prompts: Sample: "Make the recovery plan input a little bit more resilient, since as it stands right now changing "tower crane" to "forklift" changes nothing in the recommendation when it obviously should. Also changing the first crew disruption to an equipment disruption gives a generic answer. It doesn't have to be perfect, but stuff like this should at least give a reasonable looking answer." This produced a recommendation engine which was able to respond to different tools and give different recommendations. This had to be further revised to allow for different structures of the request which affect the result. Sample: Redo the aesthetic design of the web app to be mostly consistent with the design markdown file I have attached. Stick mostly to the file, but exact rigid rules will be added later. Keep the general layout as it is now, though. This changed the design of the website to be consistent with a design document I made, and is an example of an aesthetic revision I made.
Human judgment: The detailed plan summary would include "Yes." at the beginning of each answer, as if responding to a question. I had this removed since it is off-putting for a person to read.
Verification: Using the above tests and the testing from reviews, I was able to fix many of the issues at least from this implementation.
AI inside the product: The AI will eventually serve as the request processing and schedule design engine. It will receive the schedule and slippage incident from the user and produce a schedule revision with an overview of the delays, and allow for follow-ups. This is not yet implemented, but will be in such a way that the current functionality is maintained.

## Demo Video

https://drive.google.com/file/d/1pM3D0_cshCoohvfYw9zCoxY1if8U5JZ4/view?usp=drive_link
