# Copilot Instructions for vscode-rg

This project is a VSCode extension for fast, keyboard-centric recursive content search (find+grep) with a custom buffer-style UI. Follow these guidelines to be productive as an AI coding agent in this codebase.

## Architecture Overview
- **Entry Point:** `src/extension.ts` registers all extension commands and manages activation.
- **UI Logic:** `src/webview.ts` implements the buffer-style search interface, handling keyboard navigation and rendering results.
- **Input Handling:** `src/autocompletedInputBox.ts` manages the custom input box and directory navigation.
- **Tests:** `src/test/extension.test.ts` contains extension tests.
- **Build Output:** Compiled JS is output to `out/` (not in repo).

## Developer Workflows
- **Build:** `npm run compile` (single build), `npm run watch` (watch mode)
- **Test:** `npm test` (runs all tests), `npm run watch-tests` (watch mode for tests)
- **Lint:** `npm run lint`
- **Package:** `npm run package` (creates `.vsix` for install)
- **Prepublish:** `npm run vscode:prepublish` (runs all build/package steps)

## Key Patterns & Conventions
- **Command Registration:** All commands are registered in `src/extension.ts` and listed in `package.json` under `contributes.commands`.
- **Keyboard Shortcuts:** Keybindings are defined in `package.json` under `contributes.keybindings` and are active only when the custom UI is open (`vscodeRg.findgrep.active`).
- **UI State:** Use context keys (e.g., `vscodeRg.findgrep.active`) to control when commands and keybindings are enabled.
- **Navigation:** Navigation logic (up/down, page, jump, path level) is handled in the webview and input box modules, not by default VSCode UI.
- **No External Search Tools:** All search logic is implemented internally; no dependency on system `rg` or `ag` binaries.

## Integration Points
- **VSCode API:** Uses VSCode extension API for command registration, webview panels, and context key management.
- **No External Services:** No network or cloud integration.

## Examples
- To add a new keyboard shortcut, update both `contributes.keybindings` in `package.json` and handle the command in `src/webview.ts` or `src/extension.ts`.
- To change the search UI, edit `src/webview.ts` and ensure state/context keys are updated accordingly.

## References
- See `README.md` for user-facing features and install instructions.
- See `package.json` for all commands, keybindings, and scripts.
- See `src/` for all extension logic.

---
If any workflow or pattern is unclear, ask for clarification or check the referenced files for examples.
