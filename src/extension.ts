// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "scope" is now active fool!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('scope.helloWorld', () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    vscode.window.showInformationMessage('Hello World from scope!');
    console.log('Hello World from scope! inside the command...');
  });
  context.subscriptions.push(disposable);

    const disposable2 = vscode.commands.registerCommand('scope.rootFiles', async () => {
        // todo: use RG to find files based on project workspace
        const files = await vscode.workspace.findFiles('**/*');
        const fileNames = files.map(file => file.fsPath);
        const quickPick = vscode.window.createQuickPick();
        quickPick.items = fileNames.map(fileName => ({ label: fileName }));
        quickPick.canSelectMany = false;
        quickPick.onDidChangeActive((items) => {
          if (items.length > 0) {
              const selectedFile = items[0].label;
              vscode.window.showInformationMessage(selectedFile);
              vscode.workspace.openTextDocument(selectedFile).then(document => {
                  vscode.window.showTextDocument(document, { preview: true, preserveFocus: true });
              });
          }
        });
        quickPick.onDidAccept(() => {
            const selectedFile = quickPick.selectedItems[0].label;
            vscode.workspace.openTextDocument(selectedFile).then(document => {
                vscode.window.showTextDocument(document);
            });
            quickPick.dispose();
        });
        quickPick.show();
    });
  context.subscriptions.push(disposable2);

}
