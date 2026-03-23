# Note to Self

Quickly capture and retrieve ideas, thoughts, and notes from the terminal.

## When to Load
When the user wants to jot down a quick note, save an idea, record a thought, or search past notes.

## Capabilities

### Save a Note
Save the user's note to `~/.void-spirit/notes/` with:
- Filename: `YYYY-MM-DD_HHmmss.md`
- Frontmatter: `tags`, `timestamp`, `summary`
- Body: the user's note content

Example file:
```markdown
---
tags: [idea, project]
timestamp: 2025-01-15T10:30:00
summary: REST API caching strategy
---

Consider using Redis for caching API responses with a 5-min TTL.
Look into stale-while-revalidate pattern.
```

### Tag Notes
Allow the user to add tags when saving: `#idea`, `#bug`, `#learning`, `#project`, etc.

### Search Notes
Search past notes by:
- **Keyword**: grep through note contents
- **Tag**: filter by frontmatter tags
- **Date range**: filter by timestamp

Return matching notes with snippets.

### List Recent
Show the last N notes (default 10) with their summary and tags.
