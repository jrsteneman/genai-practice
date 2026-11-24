## Problem and User
This is SlipLess, a tool designed for foremen and construction project organizers in order to adapt their construction schedules in response to an adverse change of plans. In construction projects,
there may arise unexpected downtime from the labor crews, heavy construction equipment, or other essential aspects, and this downtime is known as slippage. Slippage often leads to a cascading effect on the
rest of the project since each job depends on other jobs. A recurring problem, then, is how to optimally reallocate resources to best respond to these adverse effects. There exist algorithmic methods 
of resolving this issue, but an adaptive method that responds to natural language would help save time and stress for the foremen, and this is the aim of SlipLess.

## User Journey
The user starts by inputting a construction plan into the interface, complete with the order and necessary labor crews and equipment for each job. The user may then input a brief description of the type of
slippage which is affecting this project, and SlipLess will return an in-depth description of the changes that must be made to keep an optimal reallocation as well as the time delays that will 
result from the slippage, if any occur.blin

## Features and Status
The entire core sequence is currently functional with the exception of a way to import a construction schedule, as currently there are only sample schedules. The AI-based recommendation engine with natural
language processing of inputs from the user, however, is fully functioning and so the workflow is complete starting from a sample plan. This also includes the ability to further ask follow up questions 
about the proposed resource reallocation. Implementation of a schedule importer would thus be the highest feature priority at the moment, aside from more long-term aspirations like a mobile integration.
The ability to add multiple changes sequentially would also be beneficial.

## AI Role
AI is used for two portions of the workflow: to process the user inputted description of the slippage into a concrete recommendation and to answer any follow up questions regarding the AI-proposed plan.
This implementation is distinctly advantageous over a rules-based approach, which was implemented previously within SlipLess. In that approach, the syntax recognition of inputted schedule disruptions was
very rigid and unable to give useful inputs for certain wordings without explicit programming to handle them. The AI implementation, then, is effective at giving greater flexibility for natural language
and thus an improved user experience.

## Implementation Overview
The interface allows for multiple tabs to separate different construction projects. Within each project, an overview of the jobs and necessary labor crews and equipment needed for them are displayed in 
order. There is then a text box in which some slippage scenario can be written, and when a button is pressed an in-depth description of the recommended optimal changes appears in a third box, along with 
the total delays and delays per task. There is a final box which allows for additional follow-up questions regarding the proposed changes. All of the recommendations are powered by a GPT-5 Mini API call
on the backend, with limits implemented per user to prevent excessive API charges.

## Evidence and Decisions
SlipLess was modified based on feedback to be less rigid in its recommendations and more transparent in its recommendations. The analysis and in depth job change descriptions were added specifically in 
response to user feedback, which noted that the recommendation seemed ad hoc, difficult to verify, and sometimes wrong. This allows for human audit of the response to ensure that the plan is not blindly 
enacted. The rigidity of the recommendations was also noted, which was the main impetus to get the AI recommendation engine up and running. Now, linguistic ambiguities or strange negative sentence
constructions no longer mess up the recommendation, and this has the added benefit of allowing for multiple slippages to be inputted and handled at once, which the rules based approach could not handle.
It still remains uncertain how to handle sequential slippages, however.

## Limitations and Next Steps
As stated, there is not yet a way to input multiple slippages in sequence and have the second update on the plan already implemented in the first. This is simply due to the layout of the web tool and 
would require some sort of redesign. Additionally, there is no way to input a custom construction plan yet, and so the practical benefit is not quite there yet. This would be the highest priority change,
while the sequential task redesign would follow on this. Allowing a text message interface for busy foremen would also be a longer term aspiration. 
