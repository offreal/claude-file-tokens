import * as path from "path";

import Anthropic from "@anthropic-ai/sdk";
import * as vscode from "vscode";

import { promptSetApiKey, SECRET_KEY } from "./apiKey";
import { config } from "./config";
import { DEFAULT_MODEL, normalizeModel } from "./model";
import { StatusBarController } from "./statusBar";

const DEFAULT_WARN_BYTES = 1048576;

interface CountTarget {
  text: string;
  isSelection: boolean;
  fileName: string;
}

/** What to count: a non-empty selection if there is one, otherwise the file. */
function resolveTarget(editor: vscode.TextEditor): CountTarget {
  const { selection, document } = editor;
  const selected = document.getText(selection);
  const isSelection = !selection.isEmpty && selected.trim().length > 0;

  return {
    text: isSelection ? selected : document.getText(),
    isSelection,
    fileName: path.basename(document.fileName) || "untitled",
  };
}

/**
 * Soft size guard: returns true to proceed. Asks for confirmation only when the
 * content exceeds `claudeTokens.warnAboveBytes` (0 disables the threshold).
 */
async function confirmLargeContent(text: string): Promise<boolean> {
  const warnAboveBytes = config().get<number>(
    "warnAboveBytes",
    DEFAULT_WARN_BYTES
  );
  const byteSize = Buffer.byteLength(text, "utf8");

  if (warnAboveBytes <= 0 || byteSize <= warnAboveBytes) return true;

  const proceed = await vscode.window.showWarningMessage(
    `This content is ${formatBytes(byteSize)}. Send it to the Claude API to count tokens?`,
    { modal: true },
    "Send"
  );

  return proceed === "Send";
}

export async function countTokens(
  context: vscode.ExtensionContext,
  bar: StatusBarController
): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showWarningMessage("No active editor to count.");
    return;
  }

  const target = resolveTarget(editor);

  if (target.text.trim().length === 0) {
    bar.showEmpty();
    return;
  }

  if (!(await confirmLargeContent(target.text))) return;

  const apiKey = await context.secrets.get(SECRET_KEY);

  if (!apiKey) {
    await promptSetApiKey(context, "No Claude API key set.", false);
    return;
  }

  const model = normalizeModel(config().get<string>("model", DEFAULT_MODEL));
  const run = bar.begin(target.fileName, model);

  try {
    const client = new Anthropic({ apiKey });
    const { input_tokens } = await client.messages.countTokens({
      model,
      messages: [{ role: "user", content: target.text }],
    });

    bar.showResult(run, {
      isSelection: target.isSelection,
      fileName: target.fileName,
      model,
      tokens: input_tokens,
      charCount: target.text.length,
    });
  } catch (err) {
    if (bar.showError(run)) handleError(err, model, context);
  }
}

function handleError(
  err: unknown,
  model: string,
  context: vscode.ExtensionContext
): void {
  if (err instanceof Anthropic.AuthenticationError) {
    void promptSetApiKey(
      context,
      "Claude API key was rejected. Re-enter it?",
      true
    );
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
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
