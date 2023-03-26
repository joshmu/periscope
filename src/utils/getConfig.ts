import * as vscode from 'vscode';

// CONFIG: this should match the contribution in package.json
type ConfigItems =
  | 'rgOptions'
  | 'addSrcPaths'
  | 'rgGlobExcludes'
  | 'startFolderDisplayDepth'
  | 'endFolderDisplayDepth'
  | 'enableGotoNativeSearch'
  | 'gotoNativeSearchSuffix'
  | 'peekBorderColor'
  | 'peekBorderWidth'
  | 'peekBorderStyle';

export function getConfig() {
  const vsConfig = vscode.workspace.getConfiguration('periscope');

  return {
    rgOptions: vsConfig.get<string[]>('rgOptions', [
      '--smart-case',
      '--sortr path',
    ]),
    addSrcPaths: vsConfig.get<string[]>('addSrcPaths', []),
    rgGlobExcludes: vsConfig.get<string[]>('rgGlobExcludes', []),
    startFolderDisplayDepth: vsConfig.get<number>('startFolderDisplayDepth', 1),
    endFolderDisplayDepth: vsConfig.get<number>('endFolderDisplayDepth', 4),
    enableGotoNativeSearch: vsConfig.get<boolean>(
      'enableGotoNativeSearch',
      true
    ),
    gotoNativeSearchSuffix:
      vsConfig.get<string>('gotoNativeSearchSuffix', '>>') || '>>',
    peekBorderColor: vsConfig.get<string>('peekBorderColor', 'rgb(255,255,255)'),
    peekBorderWidth: vsConfig.get<string>('peekBorderWidth', '2px'),
    peekBorderStyle: vsConfig.get<string>('peekBorderStyle', 'solid'),
  } as const satisfies { [key in ConfigItems]: any };
}