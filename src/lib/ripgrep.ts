import * as vscode from 'vscode';
import { getConfig } from "../utils/getConfig";
import { ripgrepPath } from "../utils/ripgrep";
import { context } from './context';

export function rgCommand(value: string, extraFlags?: string[]) {
  let config = getConfig();
  let workspaceFolders = vscode.workspace.workspaceFolders;

  const rgPath = ripgrepPath(config.rgPath);

  const rgRequiredFlags = [
    '--line-number',
    '--column',
    '--no-heading',
    '--with-filename',
    '--color=never',
    '--json'
  ];

  const rootPaths = workspaceFolders
    ? workspaceFolders.map(folder => folder.uri.fsPath)
    : [];

  const excludes = config.rgGlobExcludes.map(exclude => {
    return `--glob "!${exclude}"`;
  });

  const rgFlags = [
    ...rgRequiredFlags,
    ...config.rgOptions,
    ...context.rgMenuActionsSelected,
    ...rootPaths,
    ...config.addSrcPaths,
    ...(extraFlags || []),
    ...excludes,
  ];

  return `"${rgPath}" "${value}" ${rgFlags.join(' ')}`;
}