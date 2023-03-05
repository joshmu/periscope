import * as vscode from 'vscode';
import { Periscope } from './periscope';

export function activate(context: vscode.ExtensionContext) {
  console.log('<<PERISCOPE>> is now active.');

  const disposable = vscode.commands.registerCommand(
    'periscope.search',
    () => new Periscope().register()
  );
  context.subscriptions.push(disposable);
}
