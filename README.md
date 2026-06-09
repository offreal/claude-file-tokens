# Claude File Token Counter

A VS Code extension that counts how many tokens the current file (or selection)
uses against the Claude API — on demand, from the status bar.

Counting is **manual** (click, not automatic) and **model-specific**: each Claude
model has its own tokenizer, so the count is reported for the model you configure.
The extension uses the official token-counting endpoint
(`client.messages.countTokens` in `@anthropic-ai/sdk`), which returns the exact
`input_tokens` for that model — not an estimate.

> It does **not** use `tiktoken`. That is OpenAI's tokenizer and mis-counts Claude
> text by 15–20%+.

## What the number means

It is the `input_tokens` of a request where the file content is wrapped in
`messages: [{ role: "user", content: <text> }]`. That includes a small wrapper
overhead, which honestly reflects how much actually goes to the model.

## Install (from source)

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch an Extension Development Host with the
extension loaded.

## Setup

1. Open the Command Palette and run **Claude Tokens: Set API Key**, then paste a
   Claude API key. The key is stored in VS Code's encrypted **SecretStorage** —
   never in `settings.json` and never in git.
2. (Optional) Set the model via the `claudeTokens.model` setting. Default is
   `claude-opus-4-8`.

## Usage

- Click the **`$(symbol-numeric) Tokens`** item in the status bar to count the
  current file. While the request runs it shows `Counting…`; on success it shows
  `1,234 tokens`. Hover for a tooltip with the model, token count, character
  count, mode, and file name.
- If text is selected, the selection is counted (mode: *selection*); otherwise the
  whole document is counted (mode: *whole file*). Unsaved edits are included.
- The status bar resets to the neutral label when you switch editors or edit the
  text, so a stale count never lingers.

## Commands

| Command | Description |
| --- | --- |
| `Claude Tokens: Count Tokens in Current File` | Count the active file/selection (also the status-bar click action). |
| `Claude Tokens: Set API Key` | Store the Claude API key in SecretStorage. |
| `Claude Tokens: Detect Model from Claude Code` | Read `~/.claude.json` usage history for the current project and pick a model to write into the setting. |

There is no default keybinding (to avoid conflicts); bind one yourself if you like.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `claudeTokens.model` | `claude-opus-4-8` | Model ID for token counting. Free-form string. |
| `claudeTokens.warnAboveBytes` | `1048576` | Confirm before sending content larger than this many bytes. `0` disables. |

## Notes

- The SDK runs in the extension's Node host and picks up `HTTPS_PROXY` from the
  environment, so corporate proxies work without extra configuration.
- Model IDs carry no special parsing other than stripping a bracketed suffix like
  `[1m]` (a Claude Code 1M-context marker that the API rejects).

## Publishing

```bash
npm run package   # builds a .vsix with vsce
npm run publish   # publishes to the VS Code Marketplace (requires a PAT)
```

## License

MIT
