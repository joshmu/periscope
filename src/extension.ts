import * as vscode from 'vscode';
import { PERISCOPE } from './lib/periscope';
import { log, initializeOutputChannel } from './utils/log';
import { finished } from './lib/globalActions';

/**
 * @see https://code.visualstudio.com/api/get-started/extension-anatomy#extension-entry-file
 */

export function activate(context: vscode.ExtensionContext) {
  // Initialize the output channel for logging
  initializeOutputChannel(context);

  log('activate');

  const periscopeQpCmd = vscode.commands.registerCommand(
    'periscope.search',
    (args?: { rgFlags?: string[] }) => PERISCOPE.search(context, { rgFlags: args?.rgFlags }),
  );

  const periscopeSearchCurrentFileQpCmd = vscode.commands.registerCommand(
    'periscope.searchCurrentFile',
    () => PERISCOPE.search(context, { currentFileOnly: true }),
  );

  const periscopeSplitCmd = vscode.commands.registerCommand('periscope.openInHorizontalSplit', () =>
    PERISCOPE.openInHorizontalSplit(),
  );

  const periscopeResumeCmd = vscode.commands.registerCommand('periscope.resumeSearch', () =>
    PERISCOPE.resumeSearch(context),
  );

  const periscopeResumeCurrentFileCmd = vscode.commands.registerCommand(
    'periscope.resumeSearchCurrentFile',
    () => PERISCOPE.resumeSearchCurrentFile(context),
  );

  const periscopeSearchFilesCmd = vscode.commands.registerCommand('periscope.searchFiles', () =>
    vscode.commands.executeCommand('periscope.search', { rgFlags: ['--files'] }),
  );

  const periscopeBufferListCmd = vscode.commands.registerCommand('periscope.bufferList', () =>
    PERISCOPE.bufferList(),
  );

  context.subscriptions.push(
    periscopeQpCmd,
    periscopeSearchCurrentFileQpCmd,
    periscopeSplitCmd,
    periscopeResumeCmd,
    periscopeResumeCurrentFileCmd,
    periscopeSearchFilesCmd,
    periscopeBufferListCmd,
  );
}

export function deactivate() {
  log('deactivate');
  finished();
}
