# vscode-rg

A VSCode extension providing a powerful buffer search interface with keyboard-centric navigation.

## Features

- Buffer style search interface for quick navigation and filtering.
- Keyboard shortcuts for efficient list movement and selection.
- Supports up/down, page up/down, jump, and directory level navigation.

## Keybindings

| Command                                 | Key         | Description                          |
|------------------------------------------|-------------|--------------------------------------|
| Move selection up in search list         | Up / Ctrl+k | Move selection up                    |
| Move selection down in search list       | Down / Ctrl+j | Move selection down                  |
| Page down in search list                 | Ctrl+f      | Page down                            |
| Page up in search list                   | Ctrl+b      | Page up                              |
| Jump to selected item in search list     | Enter       | Jump to selected item                |
| Page left in search list                 | Left        | Page left                            |
| Page right in search list                | Right       | Page right                           |
| Move search directory up one level       | Ctrl+h      | Move directory up (in input box)     |
| Close buffer search                      | Escape      | Close the buffer search              |

## Installation

1. Download or clone this repository.
2. Run `npm install` to install dependencies.
3. Run `npm run package` to build the VSIX package.
4. Install the generated `.vsix` file in VSCode.

## Usage

- Activate the buffer search via the command palette (`vscode-rg: FindGrep`).
- Use the keyboard shortcuts to navigate and select items.
- The extension is active when the buffer search is open.

## Requirements

- Visual Studio Code version 1.99.0 or higher.

## License

MIT License
