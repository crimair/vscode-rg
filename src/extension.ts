    // jump後の再フォーカス用
    let lastJumpedFile: string | undefined = undefined;
    let lastJumpedLine: number | undefined = undefined;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { autocompletedInputBox, removePathLevel, getCurrentQuickPick, pathCompletionFunc } from './autocompletedInputBox';

export function activate(context: vscode.ExtensionContext) {
    let lastWebviewPanel: vscode.WebviewPanel | undefined;

    // Webviewを開く前のエディタ情報を保存
    let lastActiveEditor: vscode.TextEditor | undefined;
    let lastActiveSelection: vscode.Selection | undefined;
    
    const commandFindGrep = vscode.commands.registerCommand('vscode-rg.findgrep', async () => {
        let initialDir = vscode.workspace.rootPath;
        const at = vscode.window.activeTextEditor;
        if (at) {
            initialDir = path.dirname(at.document.fileName);
        }
        if (!initialDir) {
            initialDir = require('os').homedir();
        }
        let selectedPath: string | undefined;
        selectedPath = await autocompletedInputBox({
            completion: (input) => pathCompletionFunc(input, 'directory'),
            withSelf: (self) => {
                self.title = "Open Directory or File";
                self.value = initialDir || '';
                self.placeholder = "Enter path to open";

                self.items = Array.from(pathCompletionFunc(self.value, 'directory'));
            },
            contextKey: 'vscodeRg.autocompletedInputBox.active'
        });
        if (!selectedPath) { return; }
        const dir = selectedPath;

        // Webviewを開く前のエディタ情報を保存
        lastActiveEditor = vscode.window.activeTextEditor;
        lastActiveSelection = lastActiveEditor?.selection;

  // アクティブエディタの選択テキスト取得
  let initialQuery = '';
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
   const sel = activeEditor.selection;
   if (!sel.isEmpty) {
    initialQuery = activeEditor.document.getText(sel).trim();
   } else {
    // カーソル位置の単語を取得
    const wordRange = activeEditor.document.getWordRangeAtPosition(sel.active);
    if (wordRange) {
      initialQuery = activeEditor.document.getText(wordRange).trim();
    }
   }
  }

  // WebViewパネルとして検索UIを開く
  const panel = vscode.window.createWebviewPanel(
   'vscode-rg.findgrep',
   'Ripper: FindGrep (recursive content search)',
   vscode.ViewColumn.Active,
   {
    enableScripts: true,
    retainContextWhenHidden: true,
   }
  );

  lastWebviewPanel = panel;

  // vscodeRg.findgrep.activeをtrueに
  vscode.commands.executeCommand('setContext', 'vscodeRg.findgrep.active', true);

  // HTML生成（SearchEditorProviderのgetHtmlForWebviewを流用）
  panel.webview.html = getBufferSearchHtml(dir, initialQuery);

  // WebViewからのメッセージ受信
  panel.webview.onDidReceiveMessage(async message => {
      console.log('--- Message received from webview ---', message);
      if (message.type === 'search') {
        const query = message.query;
        const options = message.options || {};
        if (!query || query.trim() === '') {
          panel.webview.postMessage({ type: 'result', results: [] });
          return;
        }
        const fs = require('fs');
        if (!fs.existsSync(dir)) {
          panel.webview.postMessage({ type: 'result', results: [], error: `Directory does not exist: ${dir}` });
          return;
        }
        const { exec } = require('child_process');
        let rgFlags = ['--vimgrep', '--no-heading', '--color', 'never', '-S', '--regexp'];
        const rgCmd = `rg ${rgFlags.join(' ')} "${query.replace(/"/g, '\\"')}" "${dir}" | head -n 1000`;
        exec(rgCmd, (err: Error | null, stdout: string, stderr: string) => {
          console.log('--- rg command execution ---');
          console.log('Command:', rgCmd);
          console.log('stdout:', stdout);
          console.log('stderr:', stderr);
          if (err) {
            console.error('Error:', err);
            panel.webview.postMessage({ type: 'result', results: [], error: stderr || err.message });
            return;
          }
          const results: { file: string, line: number, col: number, text: string }[] = [];
          (stdout as string)
            .split('\n')
            .filter((line: string) => {
              // スニペット表示時は空行や--区切りを除外
              if (options.snippet) {
                return line.match(/^(.*?):(\d+):(\d+):(.*)$/);
              }
              return line;
            })
            .forEach((line: string) => {
              const m = line.match(/^(.*?):(\d+):(\d+):(.*)$/);
              if (m) {
                results.push({
                  file: path.relative(dir, m[1]),
                  line: Number(m[2]),
                  col: Number(m[3]),
                  text: m[4]
                });
              }
            });
          // {file, line, col, text}[] → {file, items: [{line, col, text}]}[] に変換
          const grouped: { [file: string]: { file: string, items: { line: number, col: number, text: string }[] } } = {};
          results.forEach(hit => {
            if (!grouped[hit.file]) {
              grouped[hit.file] = { file: hit.file, items: [] };
            }
            grouped[hit.file].items.push({ line: hit.line, col: hit.col, text: hit.text });
          });
          const groupedResults = Object.values(grouped);
          panel.webview.postMessage({ type: 'result', results: groupedResults });
        });
      } else if (message.type === 'jump') {
        let file = message.file;
        const line = message.line;
        console.log('--- Jump to file ---', file, line);
        if (file && typeof line === 'number') {
          // 相対パスなら検索ディレクトリから絶対パスに変換
          if (!file.startsWith('/')) {
            const root = dir;
            file = require('path').join(root, file);
          }
          lastJumpedFile = file;
          lastJumpedLine = line;
          vscode.workspace.openTextDocument(file).then(doc => {
            vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Active }).then(editor => {
              const pos = new vscode.Position(Math.max(0, line - 1), 0);
              editor.selection = new vscode.Selection(pos, pos);
              editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
              setTimeout(() => {
                panel.dispose();
              }, 100);
            });
          });
        }
      } else if (message.type === 'close') {
        panel.dispose();
        // Webviewを閉じた後、直前のエディタ・カーソル位置に確実に戻す
        if (lastActiveEditor && lastActiveEditor.document) {
          // 少し遅延させてから復帰（VSCodeのタイミング問題対策）
          setTimeout(() => {
            vscode.window.showTextDocument(lastActiveEditor!.document, {
              viewColumn: lastActiveEditor!.viewColumn,
              preserveFocus: false,
              preview: false
            }).then(editor => {
              if (lastActiveSelection) {
                editor.selection = lastActiveSelection;
                editor.revealRange(lastActiveSelection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
              }
            });
          }, 100);
        }
      }
    });

    panel.onDidDispose(() => {
      if (lastWebviewPanel === panel) {
        lastWebviewPanel = undefined;
      }
      // vscodeRg.findgrep.activeをfalseに
      vscode.commands.executeCommand('setContext', 'vscodeRg.findgrep.active', false);
      // jump直後なら再度showTextDocumentで確実にフォーカス
      if (lastJumpedFile && typeof lastJumpedLine === 'number') {
        vscode.workspace.openTextDocument(lastJumpedFile).then(doc => {
          vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Active }).then(editor => {
            const pos = new vscode.Position(Math.max(0, lastJumpedLine! - 1), 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
            // 1回で十分なのでクリア
            lastJumpedFile = undefined;
            lastJumpedLine = undefined;
          });
        });
      }
    });
  });

  // 選択上下コマンド登録
  const selectUpDisposable = vscode.commands.registerCommand('vscode-rg.selectUp', () => {
    console.log('--- selectUp command triggered ---1');
    if (lastWebviewPanel) {
      console.log('--- selectUp command triggered ---');
      lastWebviewPanel.webview.postMessage({ type: 'selectUp' });
    }
  });
  const selectDownDisposable = vscode.commands.registerCommand('vscode-rg.selectDown', () => {
    console.log('--- selectDown command triggered ---1');
    if (lastWebviewPanel) {
      console.log('--- selectDown command triggered ---');
      lastWebviewPanel.webview.postMessage({ type: 'selectDown' });
    }
  });
     // 6. context.subscriptions.pushで一括登録
     context.subscriptions.push(
         commandFindGrep
     );

     // 7. onDidChangeActiveTextEditor（必要なら追加、今回は省略）

     // 8. return（必要なら追加、今回は省略）

  // up/down/pageUp/pageDown/jump/closeコマンド登録
  const upDisposable = vscode.commands.registerCommand('vscode-rg.findgrep.up', () => {
    if (lastWebviewPanel) {
      lastWebviewPanel.webview.postMessage({ type: 'selectUp' });
    }
  });
  const downDisposable = vscode.commands.registerCommand('vscode-rg.findgrep.down', () => {
    if (lastWebviewPanel) {
      lastWebviewPanel.webview.postMessage({ type: 'selectDown' });
    }
  });
  const pageUpDisposable = vscode.commands.registerCommand('vscode-rg.findgrep.pageUp', () => {
    if (lastWebviewPanel) {
      lastWebviewPanel.webview.postMessage({ type: 'pageUp' });
    }
  });
  const pageDownDisposable = vscode.commands.registerCommand('vscode-rg.findgrep.pageDown', () => {
    if (lastWebviewPanel) {
      lastWebviewPanel.webview.postMessage({ type: 'pageDown' });
    }
  });
  const jumpDisposable = vscode.commands.registerCommand('vscode-rg.findgrep.jump', () => {
      if (lastWebviewPanel) {
          lastWebviewPanel.webview.postMessage({ type: 'jumpToSelected' });
      }
  });
  const leftDisposable = vscode.commands.registerCommand('vscode-rg.findgrep.left', () => {
      if (lastWebviewPanel) {
          lastWebviewPanel.webview.postMessage({ type: 'left' });
      }
  });
  const rightDisposable = vscode.commands.registerCommand('vscode-rg.findgrep.right', () => {
      if (lastWebviewPanel) {
          lastWebviewPanel.webview.postMessage({ type: 'right' });
      }
  });
  const closeDisposable = vscode.commands.registerCommand('vscode-rg.findgrep.close', () => {
      if (lastWebviewPanel) {
          console.log('--- close command triggered ---');
          lastWebviewPanel.dispose();
      }
  });
  context.subscriptions.push(upDisposable);
  context.subscriptions.push(downDisposable);
  context.subscriptions.push(pageUpDisposable);
  context.subscriptions.push(pageDownDisposable);
  context.subscriptions.push(jumpDisposable);
  context.subscriptions.push(leftDisposable);
  context.subscriptions.push(rightDisposable);
  context.subscriptions.push(closeDisposable);
  // ctrl+hで1つ上のディレクトリへ（diredと同じ構造）
  const pathLevelUpDisposable = vscode.commands.registerCommand('vscode-rg.findgrep.pathLevelUp', () => {
     console.log('--- pathLevelUp command triggered ---');
    const quickPick = getCurrentQuickPick();
    if (quickPick) {
      const currentValue = quickPick.value;
      const newValue = removePathLevel(currentValue);
      quickPick.value = newValue;
    }
  });
  context.subscriptions.push(pathLevelUpDisposable);
}


// This method is called when your extension is deactivated
export function deactivate() {}

// mini buffer WebView HTML生成
function getBufferSearchHtml(dir: string, initialQuery: string = ''): string {
  const webviewScriptContent = require('fs').readFileSync(require('path').join(__dirname, 'webview.js'), 'utf8');
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          margin: 0;
          padding: 0;
          background: var(--vscode-editor-background, var(--vscode-panel-background, #222));
          color: var(--vscode-editor-foreground, #eee);
          font-family: var(--vscode-editor-font-family, inherit);
          font-size: var(--vscode-editor-font-size, 14px);
          line-height: var(--vscode-editor-line-height, normal);
        }
        .buffersearch-root {
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .buffersearch-header {
          padding: 16px 16px 8px 16px;
          background: #222;
        }
        .buffersearch-dir-row {
          font-size: 0.9em;
          color: #888;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .input-row {
          display: flex;
          align-items: center;
        }
        .input-label {
          margin-right: 8px;
        }
        .search-input {
          flex: 1;
          background: var(--vscode-input-background, #111);
          color: var(--vscode-input-foreground, #eee);
          border: 1px solid var(--vscode-input-border, #444);
          padding: 4px 8px;
          font-size: 1em;
        }
        .result-list {
          width: 97%;
          height: 100%;
          flex: 1;
          overflow-y: auto;
          background: var(--vscode-editorWidget-background, var(--vscode-editor-background, #181818));
          border-radius: 4px;
          border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #333));
          margin-top: 0;
          padding: 0 16px;
        }
        .page-nav {
          display: inline-flex;
          align-items: center;
          margin-left: 20px;
          gap: 8px;
        }
        .page-nav button {
          margin: 0 2px;
          padding: 2px 8px;
          font-size: 1em;
        }
        .page-nav span {
          margin: 0 4px;
        }
        .result-item {
          padding: 2px 2px;
          cursor: pointer;
          font-size: 1em;
          display: flex;
          align-items: baseline;
          transition: background 0.2s;
        }
        .result-item.selected {
          background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-focusBackground, #444));
        }
        .result-file {
          color: var(--vscode-editorLineNumber-foreground, #4FC3F7);
          font-weight: bold;
          margin-right: 4px;
        }
        .result-line {
          color: var(--vscode-editorLineNumber-activeForeground, #FFD54F);
          margin-right: 4px;
        }
        .result-text {
          color: var(--vscode-editor-foreground, #eee);
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .highlight-match {
          font-weight: bold;
          background: var(--vscode-editor-findMatchHighlightBackground, #ffd700);
          color: var(--vscode-editor-foreground, #000);
          border-radius: 2px;
          padding: 0 1px;
        }
      </style>
      <script>
        window.initialQuery = ${JSON.stringify(initialQuery)};
        ${webviewScriptContent}
      </script>
    </head>
    <body>
      <div class="buffersearch-root">
        <div class="buffersearch-header">
          <div class="input-row" style="margin-bottom: 12px;">
            <input class="search-input" type="text" placeholder="Type to search..." autofocus />
          </div>
          <div id="search-dir-row" class="buffersearch-dir-row">
            <span>${dir}</span>
          </div>
        </div>
        <div class="result-list">
        </div>
      </div>
    </body>
    </html>
  `;
}
