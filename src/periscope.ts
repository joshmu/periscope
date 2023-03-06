import * as vscode from 'vscode';
import * as path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

interface QuickPickItemCustom extends vscode.QuickPickItem {
  // custom payload
  data: {
    filePath: string
    linePos: number
    colPos: number
    rawResult: string
  }
}

export const periscope = () => {
  let activeEditor: vscode.TextEditor | undefined;
  let quickPick: vscode.QuickPick<vscode.QuickPickItem | QuickPickItemCustom>;
  let workspaceFolders = vscode.workspace.workspaceFolders;

  let spawnProcess: ChildProcessWithoutNullStreams | undefined;
  const config = vscode.workspace.getConfiguration('periscope');

  function register() {
    console.log('Periscope instantiated');
    workspaceFolders = vscode.workspace.workspaceFolders;
    activeEditor = vscode.window.activeTextEditor;
    // @see https://code.visualstudio.com/api/references/vscode-api#QuickPick
    quickPick = vscode.window.createQuickPick();

    quickPick.placeholder = 'Enter a search query';
    quickPick.canSelectMany = false;
    onDidChangeValue();
    onDidChangeActive();
    onDidAccept();
    onDidHide();
    quickPick.show();
  }

  // when input query 'CHANGES'
  function onDidChangeValue() {
    quickPick.onDidChangeValue(value => {
      if (value) {
        search(value);
      } else {
        quickPick.items = [];
      }
    });
  }

  // when item is 'FOCUSSED'
  function onDidChangeActive() {
    quickPick.onDidChangeActive(items => {
      peekItem(items as readonly QuickPickItemCustom[]);
    });
  }

  // when item is 'SELECTED'
  function onDidAccept() {
    quickPick.onDidAccept(() => {
      accept();
    });
  }

  // when prompt is 'CANCELLED'
  function onDidHide() {
    checkKillProcess();

    quickPick.onDidHide(() => {
      if (!quickPick.selectedItems[0]) {
        if (activeEditor) {
          vscode.window.showTextDocument(
            activeEditor.document,
            activeEditor.viewColumn
          );
        }
      }
    });
  }

  function search(value: string) {
    // const rgCmd = rgCommand(value);
    const rgCmd = rgCommand(value);
    console.log('Periscope > search > rgCmd:', rgCmd);

    checkKillProcess();
    spawnProcess = spawn(rgCmd, [], { shell: true });

    let searchResultLines: string[] = [];
    spawnProcess.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      searchResultLines = [...searchResultLines, ...lines];
    });
    spawnProcess.stderr.on('data', (data: Buffer) => {
      console.error(data.toString());
    });
    spawnProcess.on('exit', (code: number) => {
      if (code === null) {
        return;
      }
      if (code === 0 && searchResultLines.length) {
        quickPick.items = searchResultLines
          .map(searchResult => {
            // break the filename via regext ':line:col:'
            const [filePath, linePos, colPos, ...textResult] =
              searchResult.split(':');
            const fileContents = textResult.join(':');

            // if all data is not available then remove the item
            if (!filePath || !linePos || !colPos || !fileContents) {
              return false;
            }

            return createResultItem(
              filePath,
              fileContents,
              parseInt(linePos),
              parseInt(colPos),
              searchResult
            );
          })
          .filter(Boolean) as QuickPickItemCustom[];
      } else if (code === 127) {
        vscode.window.showErrorMessage(
          `Periscope: Exited with code ${code}, ripgrep not found.`
        );
      } else if (code === 1) {
        console.error(`rg error with code ${code}`);
      } else if (code === 2) {
        console.error('No matches found');
      } else {
        vscode.window.showErrorMessage(`Ripgrep exited with code ${code}`);
      }
    });
  }

  function checkKillProcess() {
    if (spawnProcess) {
      // Kill the previous spawn process if it exists
      spawnProcess.kill();
    }
  }

  function rgCommand(value: string, excludes: string[] = []) {
    const rgRequiredFlags = [
      '--line-number',
      '--column',
      '--no-heading',
      '--with-filename',
      '--color=never',
    ];

    const rootPaths = workspaceFolders
      ? workspaceFolders.map(folder => folder.uri.fsPath)
      : [];

    const rgOptions = config.get<string[]>('rgOptions', [
      '--smart-case',
      '--sortr path',
    ]);
    const addSrcPaths = config.get<string[]>('addSrcPaths', []);

    const rgFlags = [
      ...rgRequiredFlags,
      ...rgOptions,
      ...rootPaths,
      ...addSrcPaths,
      ...excludes,
    ];

    return `rg '${value}' ${rgFlags.join(' ')}`;
  }

  function peekItem(items: readonly QuickPickItemCustom[]) {
    if (items.length === 0) {
      return;
    }

    const currentItem = items[0];
    if (!currentItem.data) {
      return;
    }

    const { filePath, linePos, colPos } = currentItem.data;
    vscode.workspace.openTextDocument(filePath).then(document => {
      vscode.window
        .showTextDocument(document, {
          preview: true,
          preserveFocus: true,
        })
        .then(editor => {
          setPos(editor, linePos, colPos);
        });
    });
  }

  function accept() {
    const currentItem = quickPick.selectedItems[0] as QuickPickItemCustom;
    if (!currentItem.data) {
      return;
    }

    const { filePath, linePos, colPos } = currentItem.data;
    vscode.workspace.openTextDocument(filePath).then(document => {
      vscode.window.showTextDocument(document).then(editor => {
        setPos(editor, linePos, colPos);
        quickPick.dispose();
      });
    });
  }

  // set cursor & view position
  function setPos(editor: vscode.TextEditor, linePos: number, colPos: number) {
    const selection = new vscode.Selection(0, 0, 0, 0);
    editor.selection = selection;

    const lineNumber = linePos ? linePos - 1 : 0;
    const charNumber = colPos ? colPos - 1 : 0;

    editor
      .edit(editBuilder => {
        editBuilder.insert(selection.active, '');
      })
      .then(() => {
        const newPosition = new vscode.Position(lineNumber, charNumber);
        const range = editor.document.lineAt(newPosition).range;
        editor.selection = new vscode.Selection(newPosition, newPosition);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      });
  }

  // required to update the quick pick item with result information
  function createResultItem(
    filePath: string,
    fileContents: string,
    linePos: number,
    colPos: number,
    rawResult?: string
  ): QuickPickItemCustom {
    return {
      label: fileContents?.trim(),
      data: {
        filePath,
        linePos,
        colPos,
        rawResult: rawResult ?? '',
      },
      // description: `${folders.join(path.sep)}`,
      detail: formatPathLabel(filePath),
      // ! required to support regex, otherwise quick pick will automatically remove results that don't have an exact match
      alwaysShow: true,
    };
  }

  function formatPathLabel(filePath: string) {
    if (!workspaceFolders) {
      return filePath;
    }

    // find correct workspace folder
    let workspaceFolder = workspaceFolders[0];
    for (const folder of workspaceFolders) {
      if (filePath.startsWith(folder.uri.fsPath)) {
        workspaceFolder = folder;
        break;
      }
    }

    const workspaceFolderName = workspaceFolder.name;
    const relativeFilePath = path.relative(workspaceFolder.uri.fsPath, filePath);
    const folders = relativeFilePath.split(path.sep);
    const folderDisplayDepth = config.get<number>('folderDisplayDepth', 4);

    // abbreviate path if too long
    if (folders.length > folderDisplayDepth) {
      folders.splice(0, folders.length - folderDisplayDepth);
      folders.unshift('...');
    }
    return `${workspaceFolderName}/${folders.join(path.sep)}`;
  }

  return {
    register,
  };
};
