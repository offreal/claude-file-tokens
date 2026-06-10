import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import * as vscode from "vscode";

import { config } from "./config";

export const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Strips bracketed suffixes such as `[1m]` (an internal Claude Code marker for
 * the 1M-context variant) that the count_tokens API does not understand.
 * Date suffixes like `-20251001` and everything else are left intact.
 */
export function normalizeModel(model: string): string {
  return model.replace(/\s*\[[^\]]*\]\s*/g, "").trim();
}

/** Picks a model from Claude Code usage history and writes it to settings. */
export async function detectModel(): Promise<void> {
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

    if (!model) continue;

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

  if (!picked) return;

  await config().update(
    "model",
    picked.label,
    vscode.ConfigurationTarget.Global
  );
  vscode.window.showInformationMessage(
    `claudeTokens.model set to "${picked.label}".`
  );
}
