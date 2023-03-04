// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { spawn } from 'child_process';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "scope" is now active!');

  const disposable2 = vscode.commands.registerCommand(
    'scope.scope',
    async () => {
      const quickPick = vscode.window.createQuickPick();
      quickPick.placeholder = 'Enter a search query';
      quickPick.canSelectMany = false;
      quickPick.onDidChangeValue(value => {
        if (value) {
          searchSpawn(quickPick, value);
        } else {
          quickPick.items = [];
        }
      });
      quickPick.onDidChangeActive(items => {
        change(items);
      });
      quickPick.onDidAccept(() => {
        accept(quickPick);
      });
      quickPick.show();
    }
  );
  context.subscriptions.push(disposable2);
}

function search(
  quickPick: vscode.QuickPick<vscode.QuickPickItem>,
  value: string
) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const rootPath = workspaceFolder?.uri.fsPath || '';
  const rgCmd = `rg -l '${value}' --no-ignore --hidden --files "${rootPath}"`;
  cp.exec(rgCmd, async (error, stdout, stderr) => {
    if (error || stderr) {
      vscode.window.showErrorMessage(error ? error.message : stderr);
      return;
    }
    const fileNames = stdout.split('\n').filter(Boolean);
    quickPick.items = fileNames.map(fileName => ({ label: fileName }));
  });
}

function searchSpawn(
  quickPick: vscode.QuickPick<vscode.QuickPickItem>,
  value: string
) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const rootPath = workspaceFolder?.uri.fsPath || '';
  // todo: update rg command to look for inner contents rather than file path match
  // const rgCmd = `rg -l '${value}' --no-ignore --hidden --files "${rootPath}"`;
  const rgCmd = `rg -l '${value}' --no-ignore --hidden --files-with-matches -S "${rootPath}"`;
  const rgProc = spawn(rgCmd, [], { shell: true });
  let fileNames: string[] = [];
  rgProc.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    fileNames = [...fileNames, ...lines];
  });
  rgProc.stderr.on('data', (data: Buffer) => {
    console.error(data.toString());
  });
  rgProc.on('exit', (code: number) => {
    if (code === 0) {
      quickPick.items = fileNames.map(fileName => ({ label: fileName }));
    } else if (code === 2) {
      vscode.window.showErrorMessage('No matches found');
    } else {
      vscode.window.showErrorMessage(`Ripgrep exited with code ${code}`);
    }
  });
}

function change(items: readonly vscode.QuickPickItem[]) {
  if (items.length > 0) {
    const selectedFile = items[0].label;
    vscode.window.showInformationMessage(selectedFile);
    vscode.workspace.openTextDocument(selectedFile).then(document => {
      vscode.window.showTextDocument(document, {
        preview: true,
        preserveFocus: true,
      });
    });
  }
}
function accept(quickPick: vscode.QuickPick<vscode.QuickPickItem>) {
  const selectedFile = quickPick.selectedItems[0].label;
  vscode.workspace.openTextDocument(selectedFile).then(document => {
    vscode.window.showTextDocument(document);
  });
  quickPick.dispose();
}
