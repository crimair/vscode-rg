# Change Log

All notable changes to the "vscode-ag" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.4]
- Add rg options: --trim, --max-column, --max-filesize.
- Terminate rg process when search results exceed limit.
- Improve WebView responsiveness during rg search by batching renderResults calls and fixing TypeScript window property error.

## [0.0.3]
- Feature: Support regex highlight in highlightMatch and add tests for regex highlighting.
- Refactor: Search now uses spawn with streaming results and search ID messaging. Removed legacy result handling in webview.

## [0.0.2]
- Fix: After jumping to a file from search results, the editor now reliably receives focus and the cursor is shown at the correct position.
- Fix: The jump destination path is now resolved relative to the searched directory, not the workspace root.


## [0.0.1] - 2025-07-12
- release 0.0.1