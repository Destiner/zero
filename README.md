# zero

⊘

a tiny coding-agent harness.

it gives the model one tool, `bash`, and a minimal role prompt: `You are a coding agent.`

Powered by [Roboport](https://github.com/Destiner/roboport).

## Run

```sh
bun install
OPENAI_API_KEY=... bun run tui
```

Enter to send a message, Shift+Enter for a newline, `/new` to start a fresh session, Ctrl+C to abort an active turn or exit.

## The Harness

This is the core agent setup:

```ts
function createAgent(): Agent {
  return new Agent({
    model: new OpenAI('gpt-5-6', {
      auth: { type: 'apiKey', apiKey: process.env.OPENAI_API_KEY },
      thinking: 'high',
    }),
    system: 'You are a coding agent.',
    tools: [bash],
    skills: [],
  });
}
```

- state-of-the-art model
- one system prompt
- one tool
- no bundled skills
- no MCP servers
- no custom planner
- no project memory layer

## Examples

The examples in [`examples/`](./examples/) are standalone HTML apps generated with Zero.

- [Tic-Tac-Toe](./examples/tic-tac-toe.html)
- [Conway's Game of Life](./examples/conway.html)
- [Pathfinding Visualizer](./examples/pathfinding-visualizer.html)
- [Pixel Editor](./examples/pixel-editor.html)
- [Local Kanban Board](./examples/kanban-board.html)

## Roboport Usage

From Roboport, Zero uses:

- `Agent` to wire the model, prompt, tools, and skills together
- `Session` to keep conversation state across turns
- `Turn` for streaming model responses
- `OpenAI` as the model adapter
- `bash` for shell execution as the only tool available to the model

## Scripts

```sh
bun install
bun run tui
bun run check
bun run typecheck
bun test
```
