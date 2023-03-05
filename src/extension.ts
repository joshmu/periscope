// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Periscope } from './periscope';

// todo: save active editor document and position
// todo: move 'periscope' to own service class
// todo: include cursor position
// todo: bring cursor position in to view always, vertically centered

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('<<PERISCOPE>> is now active.');

  const disposable = vscode.commands.registerCommand(
    'periscope.periscope',
    () => new Periscope().register()
  );
  context.subscriptions.push(disposable);
}
