import * as vscode from 'vscode';
import { PERISCOPE } from './lib/periscope';
import { log } from './utils/log';

export function activate(context: vscode.ExtensionContext) {
  log('activate');

  const periscopeQpCmd = vscode.commands.registerCommand('periscope.search', () => PERISCOPE.search());

  const periscopeQpWithSelectionCmd = vscode.commands.registerCommand('periscope.searchWithSelection', () =>
    PERISCOPE.searchWithSelection(),
  );

  const periscopeSplitCmd = vscode.commands.registerCommand('periscope.openInHorizontalSplit', () =>
    PERISCOPE.openInHorizontalSplit(),
  );

  context.subscriptions.push(periscopeQpCmd, periscopeQpWithSelectionCmd, periscopeSplitCmd);
}
