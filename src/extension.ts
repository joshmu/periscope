import * as vscode from 'vscode';
import { openInHorizontalSplit, periscope } from './periscope';

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
