import * as vscode from "vscode";

import { setApiKey } from "./apiKey";
import { countTokens } from "./count";
import { detectModel } from "./model";
import { StatusBarController } from "./statusBar";

export function activate(context: vscode.ExtensionContext): void {
  const bar = new StatusBarController();

  context.subscriptions.push(bar);

  context.subscriptions.push(
    vscode.commands.registerCommand("claudeTokens.count", () =>
      countTokens(context, bar)
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
    vscode.window.onDidChangeActiveTextEditor(() => bar.reset()),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === vscode.window.activeTextEditor?.document) bar.reset();
    })
  );
}

export function deactivate(): void {
  // StatusBarController is disposed via context.subscriptions.
}
