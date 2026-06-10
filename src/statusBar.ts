import * as vscode from "vscode";

const ICON = "$(claude)";
const NEUTRAL_TEXT = `${ICON} Tokens`;

export interface CountResult {
  isSelection: boolean;
  fileName: string;
  model: string;
  tokens: number;
  charCount: number;
}

/**
 * Owns the status-bar item and the "generation guard" that keeps a stale count
 * from landing on screen. Any invalidation (editor switch, text edit, a new
 * count starting) bumps `runToken`; a request started under an older token is
 * detected as stale via {@link isCurrent} and skipped.
 */
export class StatusBarController {
  private readonly item: vscode.StatusBarItem;
  private runToken = 0;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = "claudeTokens.count";
    this.reset();
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }

  /** Invalidate any in-flight count and show the neutral label. */
  reset(): void {
    this.runToken++;
    this.item.text = NEUTRAL_TEXT;
    this.item.tooltip =
      "Click to count tokens in the current file via Claude API";
  }

  /** Claim a new run, show the spinner, and return the run's token. */
  begin(fileName: string, model: string): number {
    const run = ++this.runToken;

    this.item.text = "$(sync~spin) Counting…";
    this.item.tooltip = `Counting tokens for ${fileName} (${model})…`;
    return run;
  }

  showEmpty(): void {
    this.item.text = `${ICON} 0 tokens`;
    this.item.tooltip = "Empty content — nothing to count.";
  }

  /** Render a successful count, unless the run has since been invalidated. */
  showResult(run: number, result: CountResult): void {
    if (run !== this.runToken) return;

    const prefix = result.isSelection ? "Selected " : "";

    this.item.text = `${ICON} ${prefix}${result.tokens.toLocaleString()} tokens`;
    this.item.tooltip = buildTooltip(result);
  }

  /**
   * Render the error state. Returns false if the run is stale (the caller
   * should then stay silent and not surface the error to the user).
   */
  showError(run: number): boolean {
    if (run !== this.runToken) return false;

    this.item.text = "$(error) Tokens";
    return true;
  }
}

function buildTooltip(result: CountResult): vscode.MarkdownString {
  const md = new vscode.MarkdownString();

  md.appendMarkdown(
    [
      "**Claude token count**",
      "",
      `- Model: \`${result.model}\``,
      `- Tokens: **${result.tokens.toLocaleString()}**`,
      `- Characters: ${result.charCount.toLocaleString()}`,
      `- Mode: ${result.isSelection ? "selection" : "whole file"}`,
      `- File: ${result.fileName}`,
    ].join("\n")
  );
  return md;
}
