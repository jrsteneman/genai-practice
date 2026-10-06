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
