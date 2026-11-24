## Product Judgment
This problem was chosen as part of an idea I  had developed for job/task reallocation for a web development task. It was supposed that a construction foreman would be a key user who would benefit from a 
job reallocation system and so I researched and built this system with that user in mind. I thus prioritized building something that solved this problem, designing the web interface to appeal to this
demographic, and to make its utility immediate and easy to see for this use case. The idea (not yet implemented) to include a text interface was a change motivated by a realization of this user and how
they are most likely to use their phones and not a computer while on their job.

## Building with AI
AI did essentially all of the building and implementation of this website, and especially helped in implementing the AI model. Even this only occurred with issues, though, as the agent was unable to obtain
API access to a small model for quite awhile until just recently, leading to a rules-based stopgap in the meantime. During the rules-based phase, small improvements would often lead to regressions in the 
syntax recognition, and so my own testing and judgment was necessary to revise it into a useful state. As an example, the recommendation engine would always include the word "Yes" at the beginning of each
of its analysis sections, which reads unnaturally and so I had to remove that while addressing the regressions in the syntax rendering that resulted from this change.

## Risks and Tradeoffs
An important issue to consider with this product as it stands is data privacy. Inputting an entire construction schedule into an LLM through an API could lead to some unintentional data leakage about the
inner workings of the construction firm that may seem innocuous at first glance. This could be especially evident if the slippage in question involves a labor slippage, where the names of employees and 
their work attendance history could be inadvertently leaked to some third party without proper handling of the situation. Stricter guards to ensure that no more information than is absolutely necessary
to reallocate the schedule could be provided in order to ensure that such unintentional leaks do not occur. Another potential risk could be a possible over-reliance on this tool and a resulting lack of 
thought toward critically thinking about the proposed reallocation. This has been partially answered by the analysis and in-depth description of the AI-proposed solution to allow for a human audit of the
result. Still, this solution relies on the user expending conscious effort to audit the solution, and so ultimately remains a risk that only a user with a penchant for cognitive effort can overcome,
although the product at least somewhat enables the user to do so.

## Safeguards and Limits
As of right now, there is a per user limit for API calls to the model to prevent excessive charges on the API back end. Furthermore, a small model was used for the back end since a large model is 
unnecessary for this task and so the charge per token can be reduced this way. The model also seems to be well-tuned to the particular task of resource allocation, as trying to run an "ignore previous 
instructions" prompt simply returned an error rather than a response to the following query. This at least disincentivizes a distributed attack to try and get free prompts out of the service, although
there could still be issues in this regard. There is a limit on repetitive prompts also, which does at least reduce the number of calls to the API if a request was already answered. The data privacy issue
mentioned previously also remains mostly unresolved, as the requests are only as private as the OpenAI API calls. If the schedule input feature begins development, that will similarly be an issue.

## Entrepreneurial Learning
I was honestly quite surprised by how straightforward it was to get a working software product using AI tools. Giving the AI some of my design documentation greatly helped the process, as it quickly got
the hang of the look I was trying to go for and fit the functionality to the aesthetics quite well. I was also impressed by how well it can handle security issues and make incremental improvements based
on the things I had already suggested. This has made me more receptive to use AI for building out ideas in the future, as I see that I can get a workable demo in very short order for just about any
idea that I can develop.
