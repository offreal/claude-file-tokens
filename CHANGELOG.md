# Changelog

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
