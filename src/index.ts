#!/usr/bin/env bun
import {
  BoxRenderable,
  TextareaRenderable,
  TextAttributes,
  TextRenderable,
  createCliRenderer,
  defaultTextareaKeyBindings,
  type CliRenderer,
  type KeyEvent,
  type ThemeMode,
} from '@opentui/core';
import { Agent, type Session, type Turn, type TurnEvent } from 'drone';
import { bash } from 'drone/harness';
import { OpenAIModel } from 'drone/models';

import summarizeInput from './format';

type ToolCard = {
  readonly toolName: string;
  readonly input: unknown;
};

type LogEntryKind = 'assistant' | 'error' | 'tool' | 'user';

type AppTheme = {
  readonly mode: ThemeMode;
  readonly background: string;
  readonly panel: string;
  readonly border: string;
  readonly focus: string;
  readonly text: string;
  readonly muted: string;
  readonly assistant: string;
  readonly user: string;
  readonly tool: string;
  readonly ok: string;
  readonly error: string;
};

const THEMES = {
  dark: {
    mode: 'dark',
    background: '#101214',
    panel: '#15181b',
    border: '#2a2f35',
    focus: '#6aa6ff',
    text: '#d7dde5',
    muted: '#78838f',
    assistant: '#d7dde5',
    user: '#b7f0c4',
    tool: '#8da0b3',
    ok: '#8bd49c',
    error: '#ff9b9b',
  },
  light: {
    mode: 'light',
    background: '#ffffff',
    panel: '#f6f8fa',
    border: '#c8d0d9',
    focus: '#0969da',
    text: '#1f2328',
    muted: '#66707c',
    assistant: '#24292f',
    user: '#116329',
    tool: '#59636e',
    ok: '#1a7f37',
    error: '#cf222e',
  },
} satisfies Record<ThemeMode, AppTheme>;

class ZeroApp {
  private readonly agent: Agent;
  private readonly renderer: CliRenderer;
  private readonly root: BoxRenderable;
  private readonly inputPanel: BoxRenderable;
  private readonly input: TextareaRenderable;
  private readonly newHint: TextRenderable;
  private readonly tools = new Map<string, ToolCard>();
  private session: Session;
  private currentTurn: Turn | null = null;
  private generation = 0;
  private openToolLineId: string | null = null;
  private assistantText = '';
  private sawTextDelta = false;
  private theme: AppTheme;

  constructor(renderer: CliRenderer, agent: Agent, theme: AppTheme) {
    this.renderer = renderer;
    this.agent = agent;
    this.theme = theme;
    this.session = agent.session();
    this.input = this.createInput(renderer);
    this.inputPanel = this.createInputPanel(renderer);
    this.newHint = this.createNewHint(renderer);
    this.root = this.createRoot(renderer);
  }

  async run(): Promise<void> {
    this.renderer.root.add(this.root);
    this.input.focus();
    this.bindKeys();
    this.bindThemeChanges();
    this.applyTheme(this.theme.mode);
    this.writeHeader();

    await new Promise<void>((resolve) => {
      this.renderer.on('destroy', (): void => {
        resolve();
      });
    });

    this.currentTurn?.abort('app closed');
    this.flushAssistantMessage();
    await this.session.close();
  }

  private createRoot(renderer: CliRenderer): BoxRenderable {
    const root = new BoxRenderable(renderer, {
      id: 'root',
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      backgroundColor: this.theme.background,
      padding: 0,
      gap: 0,
    });

    root.add(this.inputPanel);
    root.add(this.newHint);

    return root;
  }

  private createInputPanel(renderer: CliRenderer): BoxRenderable {
    const inputPanel = new BoxRenderable(renderer, {
      id: 'input-panel',
      width: '100%',
      height: 3,
      border: true,
      borderStyle: 'rounded',
      borderColor: this.theme.border,
      backgroundColor: this.theme.panel,
      paddingX: 1,
      paddingY: 0,
    });

    inputPanel.add(this.input);

    return inputPanel;
  }

  private createNewHint(renderer: CliRenderer): TextRenderable {
    return new TextRenderable(renderer, {
      id: 'new-hint',
      width: '100%',
      height: 1,
      content: '/new to create a new session.',
      fg: this.theme.muted,
      truncate: true,
    });
  }

  private createInput(renderer: CliRenderer): TextareaRenderable {
    return new TextareaRenderable(renderer, {
      id: 'prompt',
      width: '100%',
      height: 1,
      backgroundColor: this.theme.panel,
      focusedBackgroundColor: this.theme.panel,
      textColor: this.theme.text,
      focusedTextColor: this.theme.text,
      cursorColor: this.theme.focus,
      placeholder: 'Message zero',
      placeholderColor: this.theme.muted,
      wrapMode: 'word',
      keyBindings: [
        ...defaultTextareaKeyBindings,
        { name: 'return', action: 'submit' },
        { name: 'return', shift: true, action: 'newline' },
      ],
      onSubmit: (): void => {
        this.handleSubmit();
      },
    });
  }

  private bindThemeChanges(): void {
    this.renderer.on('theme_mode', (mode: ThemeMode): void => {
      this.applyTheme(mode);
    });
  }

  private applyTheme(mode: ThemeMode): void {
    this.theme = THEMES[mode];
    this.renderer.setBackgroundColor(this.theme.background);
    this.root.backgroundColor = this.theme.background;
    this.inputPanel.backgroundColor = this.theme.panel;
    this.inputPanel.borderColor = this.theme.border;
    this.inputPanel.focusedBorderColor = this.theme.focus;
    this.newHint.fg = this.theme.muted;
    this.input.backgroundColor = this.theme.panel;
    this.input.focusedBackgroundColor = this.theme.panel;
    this.input.textColor = this.theme.text;
    this.input.focusedTextColor = this.theme.text;
    this.input.cursorColor = this.theme.focus;
    this.input.placeholderColor = this.theme.muted;
    this.renderer.requestRender();
  }

  private bindKeys(): void {
    this.renderer.keyInput.on('keypress', (key: KeyEvent): void => {
      if (key.ctrl && key.name === 'c') {
        key.preventDefault();
        this.handleInterrupt();
      }
    });
  }

  private handleSubmit(): void {
    const prompt = this.input.plainText.trim();
    if (prompt.length === 0) {
      return;
    }

    if (prompt === '/new') {
      this.input.clear();
      void this.resetSession();
      return;
    }

    if (this.currentTurn !== null) {
      this.requestRender();
      return;
    }

    this.input.clear();
    this.writeUserMessage(prompt);
    void this.runTurn(prompt, this.generation);
  }

  private handleInterrupt(): void {
    if (this.currentTurn === null) {
      this.renderer.destroy();
      return;
    }

    this.currentTurn.abort('user interrupted');
    this.requestRender();
  }

  private async resetSession(): Promise<void> {
    this.generation += 1;
    const previous = this.session;
    this.currentTurn?.abort('/new');
    this.currentTurn = null;
    this.openToolLineId = null;
    this.assistantText = '';
    this.sawTextDelta = false;
    this.tools.clear();
    this.session = this.agent.session();
    this.writeHeader();
    this.requestRender();
    await previous.close();
  }

  private async runTurn(prompt: string, generation: number): Promise<void> {
    this.currentTurn = this.session.send(prompt);
    this.openToolLineId = null;
    this.assistantText = '';
    this.sawTextDelta = false;
    this.requestRender();

    try {
      for await (const event of this.currentTurn) {
        if (generation !== this.generation) {
          continue;
        }
        this.handleTurnEvent(event);
      }
    } catch (error) {
      if (generation === this.generation) {
        this.addErrorMessage(error);
      }
    } finally {
      if (generation === this.generation) {
        this.currentTurn = null;
        this.openToolLineId = null;
        this.flushAssistantMessage();
        this.requestRender();
      }
    }
  }

  private handleTurnEvent(event: TurnEvent): void {
    switch (event.type) {
      case 'message-start':
        this.startAssistantMessage();
        break;
      case 'text-delta':
        this.appendAssistantText(event.text);
        break;
      case 'text':
        this.finishAssistantText(event.text);
        break;
      case 'thinking-delta':
        this.requestRender();
        break;
      case 'tool-call':
        this.addToolCall(event.toolCallId, event.toolName, event.input);
        break;
      case 'tool-result':
        this.finishToolCall(event.toolCallId, event.isError);
        break;
      case 'error':
        this.addErrorMessage(event.error);
        break;
      case 'message-end':
      case 'thinking':
      case 'turn-end':
        break;
      default:
        assertNever(event);
    }
  }

  private startAssistantMessage(): void {
    this.flushAssistantMessage();
    this.assistantText = '';
    this.sawTextDelta = false;
  }

  private appendAssistantText(text: string): void {
    this.sawTextDelta = true;
    this.assistantText += text;
  }

  private finishAssistantText(text: string): void {
    this.assistantText = this.sawTextDelta
      ? text
      : `${this.assistantText}${text}`;
    this.flushAssistantMessage();
  }

  private flushAssistantMessage(): void {
    const text = this.assistantText.trimEnd();
    if (text.length > 0) {
      this.writeBox('assistant', text);
    }
    this.assistantText = '';
    this.sawTextDelta = false;
  }

  private writeUserMessage(prompt: string): void {
    this.flushAssistantMessage();
    this.writeBox('user', prompt);
  }

  private addErrorMessage(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.flushAssistantMessage();
    this.writeBox('error', message);
  }

  private addToolCall(
    toolCallId: string,
    toolName: string,
    input: unknown,
  ): void {
    this.flushAssistantMessage();
    this.tools.set(toolCallId, { toolName, input });
    this.openToolLineId = toolCallId;
    this.writeBox('tool', `${toolName} ... ${summarizeInput(input)}`);
    this.requestRender();
  }

  private finishToolCall(toolCallId: string, isError: boolean): void {
    const card = this.tools.get(toolCallId);
    if (card === undefined) {
      return;
    }

    this.openToolLineId = null;
    this.writeBox(
      'tool',
      `${card.toolName} ${isError ? 'error' : 'ok'} ${summarizeInput(card.input)}`,
      isError,
    );
  }

  private writeBox(kind: LogEntryKind, content: string, isError = false): void {
    const label = kind === 'user' ? 'you' : kind;
    const color = this.colorForLogEntry(kind, isError);
    const normalized = content.trimEnd();
    const lines = normalized.length > 0 ? normalized.split('\n') : [''];
    const height = Math.max(3, lines.length + 3);

    this.renderer.writeToScrollback(({ renderContext, width }) => {
      const box = new BoxRenderable(renderContext, {
        id: `log-box-${Bun.nanoseconds()}`,
        width,
        height,
        border: true,
        borderStyle: 'rounded',
        borderColor: this.theme.border,
        backgroundColor: this.theme.background,
        paddingX: 1,
        paddingY: 0,
        flexDirection: 'column',
      });
      const heading = new TextRenderable(renderContext, {
        id: `log-heading-${Bun.nanoseconds()}`,
        width: '100%',
        height: 1,
        content: label,
        fg: color,
        attributes: TextAttributes.NONE,
        truncate: true,
      });
      const body = new TextRenderable(renderContext, {
        id: `log-body-${Bun.nanoseconds()}`,
        width: '100%',
        height: Math.max(1, lines.length),
        content: normalized.length > 0 ? normalized : ' ',
        fg: this.theme.text,
        wrapMode: 'word',
      });

      box.add(heading);
      box.add(body);

      return {
        root: box,
        width,
        height,
        startOnNewLine: true,
        trailingNewline: false,
      };
    });
  }

  private writeHeader(): void {
    this.renderer.writeToScrollback(({ renderContext, width }) => {
      const line = new TextRenderable(renderContext, {
        id: `log-header-${Bun.nanoseconds()}`,
        content: '⊘',
        width,
        height: 1,
        fg: this.theme.muted,
        truncate: true,
      });

      return {
        root: line,
        width,
        height: 1,
        startOnNewLine: true,
        trailingNewline: true,
      };
    });
  }

  private colorForLogEntry(kind: LogEntryKind, isError: boolean): string {
    if (isError) {
      return this.theme.error;
    }
    switch (kind) {
      case 'assistant':
        return this.theme.assistant;
      case 'error':
        return this.theme.error;
      case 'tool':
        return this.theme.tool;
      case 'user':
        return this.theme.user;
      default:
        assertNever(kind);
    }
  }

  private requestRender(): void {
    this.renderer.requestRender();
  }
}

async function detectTheme(renderer: CliRenderer): Promise<AppTheme> {
  const detected = renderer.themeMode ?? (await renderer.waitForThemeMode(300));
  if (detected !== null) {
    return THEMES[detected];
  }

  return THEMES[inferThemeFromEnv()];
}

function inferThemeFromEnv(): ThemeMode {
  const colorFgBg = process.env.COLORFGBG;
  const background = colorFgBg?.split(';').at(-1);
  if (background !== undefined && background.length > 0) {
    const backgroundCode = Number(background);
    if (Number.isFinite(backgroundCode)) {
      return backgroundCode >= 0 && backgroundCode <= 6 ? 'dark' : 'light';
    }
  }

  return 'dark';
}

function createAgent(): Agent {
  return new Agent({
    model: new OpenAIModel('gpt-5.3-codex', {
      auth: { type: 'apiKey', apiKey: process.env.OPENAI_API_KEY },
      thinking: 'high',
    }),
    prompt: 'You are a coding agent.',
    tools: [bash],
    skills: [],
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`);
}

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  consoleMode: 'disabled',
  screenMode: 'split-footer',
  footerHeight: 4,
  externalOutputMode: 'capture-stdout',
  useMouse: false,
  enableMouseMovement: false,
  targetFps: 30,
  maxFps: 60,
});

const app = new ZeroApp(renderer, createAgent(), await detectTheme(renderer));
await app.run();
