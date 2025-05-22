import * as vscode from 'vscode';
import { PERISCOPE } from './lib/periscope';
import { log } from './utils/log';

export function activate(context: vscode.ExtensionContext) {
  log('activate');

  const periscopeQpCmd = vscode.commands.registerCommand('periscope.search', () =>
    PERISCOPE.search(),
  );

  const periscopeSplitCmd = vscode.commands.registerCommand('periscope.openInHorizontalSplit', () =>
    PERISCOPE.openInHorizontalSplit(),
  );

  context.subscriptions.push(periscopeQpCmd, periscopeSplitCmd);
}

export function deactivate() {
  log('deactivate Periscope extension');
  // Call checkKillProcess from the PERISCOPE object to clean up any running Ripgrep processes.
  PERISCOPE.checkKillProcess();
}
