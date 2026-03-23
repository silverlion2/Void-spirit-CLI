# Daily Planner

Help the user plan and reflect on their day with structured prompts.

## When to Load
When the user asks about planning their day, morning routine, standup, daily review, or end-of-day reflection.

## Capabilities

### Morning Standup
Ask the user:
1. What did you accomplish yesterday?
2. What are your top 3 priorities today?
3. Any blockers or things you need help with?

Format the answers as a concise daily plan and save to `~/.void-spirit/plans/YYYY-MM-DD.md`.

### Priority Matrix
Help categorize tasks into:
- **🔴 Urgent + Important** — Do first
- **🟡 Important, not urgent** — Schedule
- **🔵 Urgent, not important** — Delegate or batch
- **⚪ Neither** — Drop or defer

### End-of-Day Reflection
Ask the user:
1. What went well today?
2. What didn't go as planned?
3. What's the #1 thing to carry forward to tomorrow?

Append reflection to the day's plan file.

### Weekly Review
On request, aggregate the week's plans and reflections into a summary showing:
- Tasks completed vs planned
- Patterns and trends
- Suggested focus for next week
