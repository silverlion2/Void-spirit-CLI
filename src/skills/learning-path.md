# Learning Path

Track learning goals and generate practice exercises.

## When to Load
When the user wants to learn something new, track study progress, practice a skill, or set up a learning plan.

## Capabilities

### Create a Learning Plan
Ask the user:
1. What do you want to learn? (e.g. "Rust", "System Design", "React")
2. What's your current level? (beginner / intermediate / advanced)
3. How much time per day can you dedicate?

Generate a structured plan saved to `~/.void-spirit/learning/TOPIC.md`:
- Week-by-week milestones
- Recommended resources (docs, tutorials, repos)
- Practice exercises per milestone

### Track Progress
- Mark topics as ✅ completed, 🔄 in progress, or ⬜ not started
- Show overall completion percentage
- Suggest what to study next based on dependencies

### Generate Exercises
Based on the topic and level, generate:
- **Coding challenges** — small focused problems
- **Project ideas** — mini-projects to build
- **Quiz questions** — test conceptual understanding

### Spaced Repetition
Track when topics were last reviewed and suggest:
- Topics due for review (1 day, 3 days, 7 days, 30 days intervals)
- Quick review prompts for each topic

### Study Log
After each session, record:
- What was studied
- Time spent
- Key takeaways
- Confidence level (1-5)
