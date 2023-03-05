// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs';

// todo: save active editor document and position
// todo: move 'scope' to own service class
// todo: include cursor position
// todo: bring cursor position in to view always, vertically centered

interface QuickPickItemCustom extends vscode.QuickPickItem {
  data: {
    filePath: string
    relativePath: string
    linePos: number
    rawResult: string
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('<<SCOPE>> is now active.');

  const disposable = vscode.commands.registerCommand(
    'scope.scope',
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      const quickPick = vscode.window.createQuickPick();
      quickPick.placeholder = 'Enter a search query';
      quickPick.canSelectMany = false;
      quickPick.onDidChangeValue(value => {
        if (value) {
          search(quickPick, value);
        } else {
          quickPick.items = [];
        }
      });
      quickPick.onDidChangeActive(items => {
        change(
          quickPick as vscode.QuickPick<QuickPickItemCustom>,
          items as readonly QuickPickItemCustom[]
        );
      });
      quickPick.onDidAccept(() => {
        accept(quickPick as vscode.QuickPick<QuickPickItemCustom>);
      });
      quickPick.onDidHide(() => {
        if (!quickPick.selectedItems[0]) {
            if (activeEditor) {
                vscode.window.showTextDocument(activeEditor.document, activeEditor.viewColumn);
            }
        }
    });
      quickPick.show();
    }
  );
  context.subscriptions.push(disposable);
}

function search(
  quickPick: vscode.QuickPick<vscode.QuickPickItem>,
  value: string
) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const rootPath = workspaceFolder?.uri.fsPath || '';

  const ignoreFile = path.join(rootPath, '.gitignore');
  let excludes: string[] = [];
  if (fs.existsSync(ignoreFile)) {
    // const ignorePatterns = fs
    //   .readFileSync(ignoreFile)
    //   .toString()
    //   .split('\n')
    //   .filter(Boolean);

    const ignorePatterns = [
      'node_modules',
      '.git',
      '.next',
      '.vercel',
      'dist',
      'out',
      'yarn.lock',
    ];

    excludes = ignorePatterns.map(pattern => `--glob !${pattern}`);
  }

  const rgCmd = `rg -n '${value}' --no-ignore --hidden -S "${rootPath}" ${excludes.join(
    ' '
  )}`;
  const rgProc = spawn(rgCmd, [], { shell: true });
  let searchResultLines: string[] = [];
  rgProc.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    searchResultLines = [...searchResultLines, ...lines];
  });
  rgProc.stderr.on('data', (data: Buffer) => {
    console.error(data.toString());
  });
  rgProc.on('exit', (code: number) => {
    if (code === 0 && searchResultLines.length) {
      // quickPick.items = fileNames.map(fileName => ({ label: fileName }));
      quickPick.items = searchResultLines.map(searchResult => {
        // break the filename via regext ':number:'
        const [filePath, linePos, fileContents] = searchResult.split(':');

        const relativePath = path.relative(rootPath, filePath);
        const folders = relativePath.split(path.sep);
        if (folders.length > 2) {
          folders.splice(0, folders.length - 2);
          folders.unshift('...');
        }
        return {
          label: `${fileContents}`.trim(),
          data: {
            filePath,
            relativePath,
            linePos: parseInt(linePos),
            rawResult: searchResult,
          },
          description: `${folders.join(path.sep)}`,
          // detail: `${folders.join(path.sep)}`,
        };
      });
    } else if (code === 1) {
      console.error(`rg error with code ${code}`);
    } else if (code === 2) {
      vscode.window.showErrorMessage('No matches found');
    } else {
      vscode.window.showErrorMessage(`Ripgrep exited with code ${code}`);
    }
  });
}

function change(
  quickPick: vscode.QuickPick<QuickPickItemCustom>,
  items: readonly QuickPickItemCustom[]
) {
  if (items.length > 0) {
    const currentItem = items[0];
    const { filePath, linePos } = currentItem.data;
    vscode.workspace.openTextDocument(filePath).then(document => {
      vscode.window
        .showTextDocument(document, {
          preview: true,
          preserveFocus: true,
        })
        .then(editor => {
          setPos(editor, linePos);
        });
    });
  }
}
function accept(quickPick: vscode.QuickPick<QuickPickItemCustom>) {
  const { filePath, linePos } = quickPick.selectedItems[0].data;
  // todo: assign cursor position
  vscode.workspace.openTextDocument(filePath).then(document => {
    vscode.window.showTextDocument(document).then(editor => {
      setPos(editor, linePos);
      quickPick.dispose();
    });
  });
}

async function setPos(editor: vscode.TextEditor, linePos: number) {
  const selection = new vscode.Selection(0, 0, 0, 0);
  editor.selection = selection;

  const lineNumber = linePos - 1 >= 0 ? linePos - 1 : 0;

  editor
    .edit(editBuilder => {
      editBuilder.insert(selection.active, '');
    })
    .then(() => {
      const character = selection.active.character;
      const newPosition = new vscode.Position(lineNumber, character);
      editor.selection = new vscode.Selection(newPosition, newPosition);
    });
}

function fileWithPos(filePath: string, line: number, character: number) {
  return `${filePath}:${line}:${character}`;
}
