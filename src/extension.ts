import * as vscode from 'vscode';
import { periscope } from './periscope';

export function activate(context: vscode.ExtensionContext) {
  console.log('<<PERISCOPE>> is now active.');

  const disposable = vscode.commands.registerCommand(
    'periscope.search',
    () => periscope().register()
  );
  context.subscriptions.push(disposable);
}
