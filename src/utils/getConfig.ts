import * as vscode from 'vscode';
import { resolveRipgrepPath } from './ripgrepPath';

// * resolve ripgrep path on initial load only as its a blocking operation
const userRgPath = vscode.workspace
  .getConfiguration('periscope')
  .get<string | undefined>('rgPath', undefined);
const rgPath = resolveRipgrepPath(userRgPath);

export function getConfig() {
  const vsConfig = vscode.workspace.getConfiguration('periscope');

  return {
    rgPath,
    rgOptions: vsConfig.get<string[]>('rgOptions', ['--smart-case', '--sortr path']),
    addSrcPaths: vsConfig.get<string[]>('addSrcPaths', []),
    rgGlobExcludes: vsConfig.get<string[]>('rgGlobExcludes', []),
    rgMenuActions: vsConfig.get<{ label?: string; value: string }[]>('rgMenuActions', []),
    rgQueryParams: vsConfig.get<{ param?: string; regex: string }[]>('rgQueryParams', []),
    rgQueryParamsShowTitle: vsConfig.get<boolean>('rgQueryParamsShowTitle', true),
    showWorkspaceFolderInFilePath: vsConfig.get<boolean>('showWorkspaceFolderInFilePath', true),
    startFolderDisplayIndex: vsConfig.get<number>('startFolderDisplayIndex', 0),
    startFolderDisplayDepth: vsConfig.get<number>('startFolderDisplayDepth', 1),
    endFolderDisplayDepth: vsConfig.get<number>('endFolderDisplayDepth', 4),
    alwaysShowRgMenuActions: vsConfig.get<boolean>('alwaysShowRgMenuActions', true),
    showPreviousResultsWhenNoMatches: vsConfig.get<boolean>(
      'showPreviousResultsWhenNoMatches',
      false,
    ),
    gotoRgMenuActionsPrefix: vsConfig.get<string>('gotoRgMenuActionsPrefix', '<<') || '<<',
    enableGotoNativeSearch: vsConfig.get<boolean>('enableGotoNativeSearch', true),
    gotoNativeSearchSuffix: vsConfig.get<string>('gotoNativeSearchSuffix', '>>') || '>>',
    peekBorderColor: vsConfig.get<string>('peekBorderColor', 'rgb(150,200,200)'),
    peekBorderWidth: vsConfig.get<string>('peekBorderWidth', '2px'),
    peekBorderStyle: vsConfig.get<string>('peekBorderStyle', 'solid'),
  };
}
