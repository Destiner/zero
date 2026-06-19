# zero

Minimal CLI-style TUI wrapper for the coding agent.

```sh
bun run tui
```

Output is written to normal terminal scrollback while the prompt stays pinned
at the bottom under a `⊘` marker. Type a message and press Enter to send it.
Use Shift+Enter for a newline, `/new` to start a fresh session, and Ctrl+C to
abort an active turn or exit when idle. Colors follow the terminal light/dark
theme when the terminal reports it.

## Scripts

```sh
bun install
bun run tui
bun run check
bun run typecheck
```
