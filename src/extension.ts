import * as vscode from 'vscode';
import { PERISCOPE } from './lib/periscope';
import { log } from './utils/log';

export function activate(context: vscode.ExtensionContext) {
  log('activate');

  const periscopeQpCmd = vscode.commands.registerCommand('periscope.search', () => PERISCOPE.search());

  const periscopeQpFilesCmd = vscode.commands.registerCommand('periscope.searchFiles', () => PERISCOPE.searchFiles());

  const periscopeSplitCmd = vscode.commands.registerCommand('periscope.openInHorizontalSplit', () =>
    PERISCOPE.openInHorizontalSplit(),
  );

  context.subscriptions.push(periscopeQpCmd, periscopeQpFilesCmd, periscopeSplitCmd);
}
