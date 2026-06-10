import * as vscode from "vscode";

export const SECRET_KEY = "claudeTokens.apiKey";

/** Prompts for the Claude API key and stores it in SecretStorage. */
export async function setApiKey(
  context: vscode.ExtensionContext
): Promise<void> {
  const key = await vscode.window.showInputBox({
    prompt: "Claude API key",
    placeHolder: "sk-ant-…",
    password: true,
    ignoreFocusOut: true,
  });

  if (key === undefined) return; // cancelled

  const trimmed = key.trim();

  if (!trimmed) {
    vscode.window.showWarningMessage("No API key entered.");
    return;
  }

  await context.secrets.store(SECRET_KEY, trimmed);
  vscode.window.showInformationMessage("Claude API key saved.");
}

/** Shows a message with a "Set API Key" button and runs setApiKey if clicked. */
export async function promptSetApiKey(
  context: vscode.ExtensionContext,
  message: string,
  isError: boolean
): Promise<void> {
  const show = isError
    ? vscode.window.showErrorMessage
    : vscode.window.showWarningMessage;
  const choice = await show(message, "Set API Key");

  if (choice === "Set API Key") await setApiKey(context);
}
