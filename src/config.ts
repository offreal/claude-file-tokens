import * as vscode from "vscode";

export const CONFIG_SECTION = "claudeTokens";

export function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(CONFIG_SECTION);
}
