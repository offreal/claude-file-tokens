# Changelog

## 0.1.6

- Packaging: exclude local editor config (`.claude/`) from the published
  extension. No functional changes.

## 0.1.5

- Fix a race where a count that finished after you switched editors or edited
  text could overwrite the status bar with a stale number for the wrong file.
- Internal: split the single source file into focused modules
  (`statusBar`, `count`, `model`, `apiKey`, `config`) and encapsulate the
  status bar behind a controller.
- Tooling: add ESLint and Prettier, move to pnpm, drop the build-only
  `@resvg/resvg-js` dependency and the icon-rendering scripts.

## 0.1.4

- Add the **AI** Marketplace category.
- Require VS Code `^1.110.0` so the `claude` status-bar icon always renders.

## 0.1.3

- Sharper short description shown in the Marketplace and search.

## 0.1.2

- Rewrite the README (features, getting-started, where to get an API key,
  commands and settings tables) and add a demo GIF.
- Add a Marketplace gallery banner.

## 0.1.1

- Add an extension icon.

## 0.1.0

Initial release.

- Status-bar button that counts tokens in the current file via the official
  Claude token-counting endpoint (`messages.countTokens`).
- Counts a non-empty selection (shown as `Selected N tokens`) or the whole file
  (`N tokens`), using the in-memory text including unsaved edits.
- Model-specific counting via the `claudeTokens.model` setting.
- API key stored in VS Code SecretStorage; **Set API Key** command.
- **Detect Model from Claude Code** command reads `~/.claude.json` usage history.
- Soft size guard (`claudeTokens.warnAboveBytes`) with confirmation before
  sending large content.
- Status bar resets to a neutral label on editor switch or text edit so a stale
  count never lingers.
- Typed error handling for auth, unknown model, rate limit, oversized request,
  and network failures.
