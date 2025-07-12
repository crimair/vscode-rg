// パス補完用関数
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * ディレクトリ・ファイルのパス補完を行うジェネレータ
 */
export function* pathCompletionFunc(
  filePathOrDirPath: string,
  completionType: 'all' | 'directory' | 'file' = 'all'
): IterableIterator<vscode.QuickPickItem> {
  let dirname: string;
  const baseDir = vscode.workspace.rootPath || require('os').homedir();
  if (!baseDir) return;

  if (!path.isAbsolute(filePathOrDirPath)) {
    filePathOrDirPath = path.join(baseDir, filePathOrDirPath);
  }

  try {
    let stat = fs.statSync(filePathOrDirPath);
    if (stat.isDirectory()) {
      dirname = filePathOrDirPath;
      if (completionType === 'all' || completionType === 'directory') {
        yield {
          detail: "Target directory: " + path.basename(filePathOrDirPath) + "/",
          label: filePathOrDirPath,
          buttons: [ { iconPath: vscode.ThemeIcon.Folder } ]
        };
      }
    } else {
      if (completionType === 'all' || completionType === 'file') {
        yield {
          detail: "Target file: " + path.basename(filePathOrDirPath),
          label: filePathOrDirPath,
          buttons: [ { iconPath: vscode.ThemeIcon.File } ]
        };
      }
      dirname = path.dirname(filePathOrDirPath);
    }
  } catch {
    if (completionType === 'all' || completionType === 'file') {
      yield {
        detail: "Create/Rename to: " + path.basename(filePathOrDirPath),
        label: filePathOrDirPath,
        buttons: [ { iconPath: vscode.ThemeIcon.File } ]
      };
    }
    dirname = path.dirname(filePathOrDirPath);
    try {
      fs.accessSync(dirname, fs.constants.F_OK);
    } catch {
      return;
    }
  }
  try {
    const dirItems: vscode.QuickPickItem[] = [];
    const fileItems: vscode.QuickPickItem[] = [];
    for (let name of fs.readdirSync(dirname)) {
      const fullpath = path.join(dirname, name);
      try {
        const stat = fs.statSync(fullpath);
        if (stat.isDirectory()) {
          if (completionType === 'all' || completionType === 'directory') {
            dirItems.push({
              label: fullpath, detail: "Open " + name + "/",
              buttons: [ { iconPath: vscode.ThemeIcon.Folder } ]
            });
          }
        } else {
          if (completionType === 'all' || completionType === 'file') {
            fileItems.push({
              label: fullpath, detail: "Open " + name,
              buttons: [ { iconPath: vscode.ThemeIcon.File } ]
            });
          }
        }
      } catch (statErr) {}
    }
    for (const item of dirItems) yield item;
    for (const item of fileItems) yield item;
  } catch (readDirErr) {}
}

// Global management of QuickPick instances
let currentActiveQuickPick: vscode.QuickPick<vscode.QuickPickItem> | null = null;

export function getCurrentQuickPick(): vscode.QuickPick<vscode.QuickPickItem> | null {
    return currentActiveQuickPick;
}

// Path level removal logic
export function removePathLevel(path: string): string {
    if (!path.includes('/')) {
        return ''; // Return empty string if no '/' found
    }
    
    // Remove trailing '/' before processing
    let trimmedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    
    if (trimmedPath === '') {
        return ''; // Return empty string if already empty
    }
    
    if (trimmedPath === '/') {
        return ''; // Return empty string for root directory
    }
    
    const lastSlashIndex = trimmedPath.lastIndexOf('/');
    if (lastSlashIndex === -1) {
        return ''; // Return empty string if no '/' found
    }
    
    if (lastSlashIndex === 0) {
        return '/'; // Return root for paths at root level
    }
    
    return trimmedPath.substring(0, lastSlashIndex + 1);
}

export function defaultFinishCondition(self: vscode.QuickPick<vscode.QuickPickItem>) {
    if (self.selectedItems.length == 0 || self.selectedItems[0].label == self.value) {
        return true;
    }
    else {
        self.value = self.selectedItems[0].label;
        return false;
    }
}

export async function autocompletedInputBox<T>(
    arg: {
        completion: (userinput: string) => Iterable<vscode.QuickPickItem>,
        withSelf?: undefined | ((self: vscode.QuickPick<vscode.QuickPickItem>) => any),
        stopWhen?: undefined | ((self: vscode.QuickPick<vscode.QuickPickItem>) => boolean)
    contextKey?: string
    }) {
    const completionFunc = arg.completion;
    const processSelf = arg.withSelf;
    const contextKey = arg.contextKey || 'vscodeRg.autocompletedInputBox.active';

    let finishCondition = defaultFinishCondition;
    if (arg.stopWhen != undefined)
        finishCondition = defaultFinishCondition


    const quickPick = vscode.window.createQuickPick();
    quickPick.canSelectMany = false;
    console.log('Creating QuickPick instance'); 
    // Register QuickPick instance globally and set context key
    currentActiveQuickPick = quickPick;
    vscode.commands.executeCommand('setContext', contextKey, true).then(() => {
        vscode.commands.executeCommand('inspectContextKeys');
        console.log('[DEBUG] setContext', contextKey, '= true');
    });
    
    let disposables: vscode.Disposable[] = [];
    let result: string | undefined = undefined; // Initialize result to undefined
    let accepted = false; // Flag to track if accepted via Enter

    if (processSelf !== undefined)
        processSelf(quickPick);

    let makeTask = () => new Promise<string | undefined>(resolve => { // Return type includes undefined
        disposables.push(
            quickPick.onDidChangeValue(directoryOrFile => {
                quickPick.items = Array.from(completionFunc(quickPick.value))
                return 0;
            }),
            quickPick.onDidAccept(() => {
                if (finishCondition(quickPick)) {
                    result = quickPick.value;
                    accepted = true; // Mark as accepted
                    quickPick.hide();
                    // Don't resolve here, let onDidHide handle resolution
                }
            }),
            quickPick.onDidHide(() => {
                // Clean up QuickPick instance and disable context key
                currentActiveQuickPick = null;
                vscode.commands.executeCommand('setContext', contextKey, false);
                
                quickPick.dispose();
                if (accepted) {
                    resolve(result); // Resolve with the accepted value
                } else {
                    resolve(undefined); // Resolve with undefined if cancelled (e.g., Esc)
                }
            })
        );
        quickPick.show();
    });

    try {
        result = await makeTask(); // Assign the resolved value (string or undefined)
    }
    finally {
        disposables.forEach(d => d.dispose());
    }
    return result; // Return the final result (string or undefined)
}
