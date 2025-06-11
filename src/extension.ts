import * as vscode from 'vscode';
import { PERISCOPE } from './lib/periscope';
import { log } from './utils/log';
import { finished } from './lib/globalActions';

/**
 * @see https://code.visualstudio.com/api/get-started/extension-anatomy#extension-entry-file
 */

export function activate(context: vscode.ExtensionContext) {
  log('activate');

  const periscopeQpCmd = vscode.commands.registerCommand('periscope.search', () =>
    PERISCOPE.search(),
  );

  const periscopeSearchCurrentFileQpCmd = vscode.commands.registerCommand(
    'periscope.searchCurrentFile',
    () => PERISCOPE.search({ currentFileOnly: true }),
  );

  const periscopeSplitCmd = vscode.commands.registerCommand('periscope.openInHorizontalSplit', () =>
    PERISCOPE.openInHorizontalSplit(),
  );

  context.subscriptions.push(periscopeQpCmd, periscopeSearchCurrentFileQpCmd, periscopeSplitCmd);
}

export function deactivate() {
  log('deactivate');
  finished();
}
