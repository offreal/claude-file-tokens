import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import Anthropic from "@anthropic-ai/sdk";
import * as vscode from "vscode";

const SECRET_KEY = "claudeTokens.apiKey";
const NEUTRAL_TEXT = "$(claude) Tokens";

let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.command = "claudeTokens.count";
  resetStatusBar();
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("claudeTokens.count", () =>
      countTokens(context)
    ),
    vscode.commands.registerCommand("claudeTokens.setApiKey", () =>
      setApiKey(context)
    ),
    vscode.commands.registerCommand("claudeTokens.detectModel", () =>
      detectModel()
    )
  );

  // The displayed number goes stale the moment the editor or text changes;
  // drop back to the neutral label so a stale count never lingers on screen.
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => resetStatusBar()),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === vscode.window.activeTextEditor?.document) {
        resetStatusBar();
      }
    })
  );
}

export function deactivate(): void {
  // Status bar is disposed via context.subscriptions.
}

function resetStatusBar(): void {
  statusBar.text = NEUTRAL_TEXT;
  statusBar.tooltip = "Click to count tokens in the current file via Claude API";
}

async function setApiKey(context: vscode.ExtensionContext): Promise<void> {
  const key = await vscode.window.showInputBox({
    prompt: "Claude API key",
    placeHolder: "sk-ant-…",
    password: true,
    ignoreFocusOut: true,
  });
  if (key === undefined) {
    return; // cancelled
  }
  const trimmed = key.trim();
  if (!trimmed) {
    vscode.window.showWarningMessage("No API key entered.");
    return;
  }
  await context.secrets.store(SECRET_KEY, trimmed);
  vscode.window.showInformationMessage("Claude API key saved.");
}

/**
 * Strips bracketed suffixes such as `[1m]` (an internal Claude Code marker for
 * the 1M-context variant) that the count_tokens API does not understand.
 * Date suffixes like `-20251001` and everything else are left intact.
 */
function normalizeModel(model: string): string {
  return model.replace(/\s*\[[^\]]*\]\s*/g, "").trim();
}

async function detectModel(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showInformationMessage(
      "Open a workspace folder to detect the model from Claude Code usage history."
    );
    return;
  }

  const configPath = path.join(os.homedir(), ".claude.json");
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch {
    vscode.window.showInformationMessage(
      `Could not read ${configPath}. Set the model manually in settings.`
    );
    return;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    vscode.window.showWarningMessage(`Failed to parse ${configPath}.`);
    return;
  }

  const projectPath = folder.uri.fsPath;
  const usage: Record<string, unknown> | undefined =
    parsed?.projects?.[projectPath]?.lastModelUsage;

  if (!usage || typeof usage !== "object") {
    vscode.window.showInformationMessage(
      "No model usage history found for this project in ~/.claude.json."
    );
    return;
  }

  // Aggregate normalized model IDs (several raw keys may collapse to one).
  const counts = new Map<string, number>();
  for (const [rawModel, value] of Object.entries(usage)) {
    const model = normalizeModel(rawModel);
    if (!model) {
      continue;
    }
    const n = typeof value === "number" ? value : 0;
    counts.set(model, (counts.get(model) ?? 0) + n);
  }

  if (counts.size === 0) {
    vscode.window.showInformationMessage(
      "No usable model entries found in ~/.claude.json."
    );
    return;
  }

  const items: vscode.QuickPickItem[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([model, n]) => ({
      label: model,
      description: n > 0 ? `${n.toLocaleString()} tokens` : undefined,
    }));

  const picked = await vscode.window.showQuickPick(items, {
    title: "Detected models from Claude Code",
    placeHolder: "Select a model to write to claudeTokens.model",
  });
  if (!picked) {
    return;
  }

  await vscode.workspace
    .getConfiguration("claudeTokens")
    .update("model", picked.label, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(
    `claudeTokens.model set to "${picked.label}".`
  );
}

async function countTokens(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor to count.");
    return;
  }

  const selection = editor.selection;
  const isSelection = !selection.isEmpty && editor.document.getText(selection).trim().length > 0;
  const mode: "selection" | "file" = isSelection ? "selection" : "file";
  const text = isSelection
    ? editor.document.getText(selection)
    : editor.document.getText();

  const fileName = path.basename(editor.document.fileName) || "untitled";

  if (text.trim().length === 0) {
    statusBar.text = "$(claude) 0 tokens";
    statusBar.tooltip = "Empty content — nothing to count.";
    return;
  }

  // Soft size guard (decision 3): warn before sending very large content.
  const warnAboveBytes = vscode.workspace
    .getConfiguration("claudeTokens")
    .get<number>("warnAboveBytes", 1048576);
  const byteSize = Buffer.byteLength(text, "utf8");
  if (warnAboveBytes > 0 && byteSize > warnAboveBytes) {
    const proceed = await vscode.window.showWarningMessage(
      `This content is ${formatBytes(byteSize)}. Send it to the Claude API to count tokens?`,
      { modal: true },
      "Send"
    );
    if (proceed !== "Send") {
      return;
    }
  }

  const apiKey = await context.secrets.get(SECRET_KEY);
  if (!apiKey) {
    const choice = await vscode.window.showWarningMessage(
      "No Claude API key set.",
      "Set API Key"
    );
    if (choice === "Set API Key") {
      await setApiKey(context);
    }
    return;
  }

  const configuredModel = vscode.workspace
    .getConfiguration("claudeTokens")
    .get<string>("model", "claude-opus-4-8");
  const model = normalizeModel(configuredModel);

  statusBar.text = "$(sync~spin) Counting…";
  statusBar.tooltip = `Counting tokens for ${fileName} (${model})…`;

  try {
    const client = new Anthropic({ apiKey });
    const result = await client.messages.countTokens({
      model,
      messages: [{ role: "user", content: text }],
    });

    const tokens = result.input_tokens;
    const prefix = mode === "selection" ? "Selected " : "";
    statusBar.text = `$(claude) ${prefix}${tokens.toLocaleString()} tokens`;

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Claude token count**\n\n`);
    md.appendMarkdown(`- Model: \`${model}\`\n`);
    md.appendMarkdown(`- Tokens: **${tokens.toLocaleString()}**\n`);
    md.appendMarkdown(`- Characters: ${text.length.toLocaleString()}\n`);
    md.appendMarkdown(`- Mode: ${mode === "selection" ? "selection" : "whole file"}\n`);
    md.appendMarkdown(`- File: ${fileName}\n`);
    statusBar.tooltip = md;
  } catch (err) {
    statusBar.text = "$(error) Tokens";
    handleError(err, model, context);
  }
}

function handleError(
  err: unknown,
  model: string,
  context: vscode.ExtensionContext
): void {
  if (err instanceof Anthropic.AuthenticationError) {
    void vscode.window
      .showErrorMessage(
        "Claude API key was rejected. Re-enter it?",
        "Set API Key"
      )
      .then((choice) => {
        if (choice === "Set API Key") {
          void setApiKey(context);
        }
      });
    return;
  }
  if (err instanceof Anthropic.NotFoundError) {
    vscode.window.showErrorMessage(`Unknown model: "${model}".`);
    return;
  }
  if (err instanceof Anthropic.APIError && err.status === 413) {
    vscode.window.showErrorMessage(
      "The content is too large for the Claude API. Count a smaller selection."
    );
    return;
  }
  if (err instanceof Anthropic.RateLimitError) {
    vscode.window.showErrorMessage(
      "Claude API rate limit reached. Wait a moment and try again."
    );
    return;
  }
  if (err instanceof Anthropic.APIConnectionError) {
    vscode.window.showErrorMessage(
      "Could not reach the Claude API. Check your network connection."
    );
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  vscode.window.showErrorMessage(`Token count failed: ${message}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
