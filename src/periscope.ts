import * as vscode from 'vscode';
import * as path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { getConfig } from './utils/getConfig';
import { getSelectedText } from './utils/getSelectedText';
import { highlightDecorationType } from './utils/decorationType';

export interface QuickPickItemCustom extends vscode.QuickPickItem {
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
  let query = '';
  let highlightDecoration = highlightDecorationType();

  let spawnProcess: ChildProcessWithoutNullStreams | undefined;
  let config = getConfig();
  let rgMenuActionsSelected: string[] = [];

  function register() {
    setActiveContext(true);
    console.log('PERISCOPE: start');
    config = getConfig();
    workspaceFolders = vscode.workspace.workspaceFolders;
    activeEditor = vscode.window.activeTextEditor;
    // @see https://code.visualstudio.com/api/references/vscode-api#QuickPick
    quickPick = vscode.window.createQuickPick();

    quickPick.placeholder = '🫧';

    // if ripgrep actions are available then open preliminary quickpick
    config.rgMenuActions.length ? setupRgMenuActions(quickPick) : setupQuickPickForQuery(quickPick);

    quickPick.onDidHide(onDidHide);
    quickPick.show();
  }

  // when ripgrep actions are available show preliminary quickpick for those options to add to the query
  function setupRgMenuActions(quickPick: vscode.QuickPick<vscode.QuickPickItem | QuickPickItemCustom>) {
    quickPick.canSelectMany = true;
    
    // add items from the config
    quickPick.items = config.rgMenuActions.map(item => ({
      label: item,
    }));

    quickPick.onDidAccept(() => {
      rgMenuActionsSelected = quickPick.selectedItems.map(item => item.label);
      setupQuickPickForQuery(quickPick);
    });
  }

  // update quickpick event listeners for the query
  function setupQuickPickForQuery(quickPick: vscode.QuickPick<vscode.QuickPickItem | QuickPickItemCustom>) {
    quickPick.items = [];
    quickPick.canSelectMany = false;
    quickPick.value = getSelectedText();
    quickPick.onDidChangeValue(onDidChangeValue);
    quickPick.onDidChangeActive(onDidChangeActive);
    quickPick.onDidAccept(onDidAccept);
  }

  // create vscode context for the extension for targeted keybindings
  function setActiveContext(flag: boolean) {
    console.log(`PERISCOPE: setContext ${flag}`);
    vscode.commands.executeCommand('setContext', 'periscopeActive', flag);
  }

  // when input query 'CHANGES'
  function onDidChangeValue(value: string) {
    checkKillProcess();

    if (value) {
      query = value;

      // Jump to native vscode search option
      if (
        config.enableGotoNativeSearch &&
        config.gotoNativeSearchSuffix &&
        value.endsWith(config.gotoNativeSearchSuffix)
      ) {
        openNativeVscodeSearch();
        return;
      }

      search(value);
    } else {
      quickPick.items = [];
    }
  }

  // when item is 'FOCUSSED'
  function onDidChangeActive(items: readonly (vscode.QuickPickItem | QuickPickItemCustom)[]) {
    peekItem(items as readonly QuickPickItemCustom[]);
  }

  // when item is 'SELECTED'
  function onDidAccept() {
    accept();
  }

  // when prompt is 'CANCELLED'
  function onDidHide() {
    if (!quickPick.selectedItems[0]) {
      if (activeEditor) {
        vscode.window.showTextDocument(
          activeEditor.document,
          activeEditor.viewColumn
        );
      }
    }

    finished();
  }

  function search(value: string) {
    quickPick.busy = true;
    const rgCmd = rgCommand(value);
    console.log('PERISCOPE: rgCmd:', rgCmd);

    checkKillProcess();
    spawnProcess = spawn(rgCmd, [], { shell: true });

    let searchResultLines: string[] = [];
    spawnProcess.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      searchResultLines = [...searchResultLines, ...lines];
    });
    spawnProcess.stderr.on('data', (data: Buffer) => {
      console.error('PERISCOPE:', data.toString());
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
        console.log(`PERISCOPE: rg exited with code ${code}`);
      } else if (code === 2) {
        console.error('PERISCOPE: No matches found');
      } else {
        vscode.window.showErrorMessage(`Ripgrep exited with code ${code}`);
      }
      quickPick.busy = false;
    });
  }

  function checkKillProcess() {
    if (spawnProcess) {
      // Kill the previous spawn process if it exists
      spawnProcess.kill();
    }
  }

  function rgCommand(value: string) {
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

    const excludes = config.rgGlobExcludes.map(exclude => {
      return `--glob '!${exclude}'`;
    });

    const rgFlags = [
      ...rgRequiredFlags,
      ...config.rgOptions,
      ...rgMenuActionsSelected,
      ...rootPaths,
      ...config.addSrcPaths,
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
        highlightDecoration.set(editor);
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
    const folders = [workspaceFolderName, ...relativeFilePath.split(path.sep)];

    // abbreviate path if too long
    if (
      folders.length >
      config.startFolderDisplayDepth + config.endFolderDisplayDepth
    ) {
      const initialFolders = folders.splice(0, config.startFolderDisplayDepth);
      folders.splice(0, folders.length - config.endFolderDisplayDepth);
      folders.unshift(...initialFolders, '...');
    }
    return folders.join(path.sep);
  }

  // Open the native VSCode search with the provided query and enable regex
  function openNativeVscodeSearch() {
    // remove the config suffix from the query
    const trimmedQuery = query.slice(
      0,
      query.indexOf(config.gotoNativeSearchSuffix)
    );

    vscode.commands.executeCommand('workbench.action.findInFiles', {
      query: trimmedQuery,
      isRegex: true,
      isCaseSensitive: false,
      matchWholeWord: false,
      triggerSearch: true,
    });

    // close extension down
    quickPick.hide();
  }

  function finished() {
    checkKillProcess();
    highlightDecoration.remove();
    setActiveContext(false);
    console.log('PERISCOPE: finished');
  }

  return {
    register,
  };
};
