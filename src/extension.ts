import * as vscode from 'vscode';
import { periscope } from './lib/periscope';
import { openInHorizontalSplit } from './lib/editorActions';

export function activate(context: vscode.ExtensionContext) {
  console.log('<<PERISCOPE>> is now active.');

  const periscopeQpCmd = vscode.commands.registerCommand('periscope.search',
    () => periscope().register()
  );

  const periscopeSplitCmd = vscode.commands.registerCommand("periscope.openInHorizontalSplit", () => {
    openInHorizontalSplit();
  });

  context.subscriptions.push(periscopeQpCmd, periscopeSplitCmd);
}
