import { Agent } from 'drone';
import type { TurnEvent } from 'drone';
import { bash } from 'drone/harness';
import { OpenAIModel } from 'drone/models';

const agent = new Agent({
  model: new OpenAIModel('gpt-5.3-codex', {
    auth: { type: 'apiKey', apiKey: process.env.OPENAI_API_KEY },
    thinking: 'high',
  }),
  prompt: 'You are a coding agent.',
  tools: [bash],
  skills: [],
});

await using session = agent.session();
const turn = session.send(
  "Implement Conway's Game of Life in HTML, CSS, and JavaScript. Put it under output/conway.html.",
);
for await (const event of turn) {
  const line = formatEvent(event);
  if (line !== null) {
    console.log(line);
  }
}

function formatEvent(event: TurnEvent): string | null {
  switch (event.type) {
    case 'text':
      return `assistant: ${event.text}`;
    case 'thinking':
      return `[thinking] ${event.text}`;
    case 'tool-call':
      return `[tool-call] ${event.toolName}(${JSON.stringify(event.input)})`;
    case 'tool-result':
      return `[tool-result${event.isError ? ' error' : ''}] ${event.toolName} -> ${JSON.stringify(event.output)}`;
    case 'error':
      return `[error] ${event.error.message}`;
    default:
      return null;
  }
}
