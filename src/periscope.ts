import * as vscode from 'vscode';
import * as path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { getConfig } from './utils/getConfig';
import { getSelectedText } from './utils/getSelectedText';
import { highlightDecorationType } from './utils/decorationType';

export interface QPItemDefault extends vscode.QuickPickItem {
  _type: 'QuickPickItemDefault'
}
export interface QPItemQuery extends vscode.QuickPickItem {
  _type: 'QuickPickItemQuery'
  // custom payload
  data: {
    filePath: string
    linePos: number
    colPos: number
    rawResult: string
  }
}
export interface QPItemRgMenuAction extends vscode.QuickPickItem {
  _type: 'QuickPickItemRgMenuAction'
  // custom payload
  data: {
    rgOption: string
  }
}

type AllQPItemVariants = QPItemDefault | QPItemQuery | QPItemRgMenuAction;

type DisposablesMap = {
  general: vscode.Disposable[]
  rgMenuActions: vscode.Disposable[]
  query: vscode.Disposable[]
};

// Allow other commands to access the QuickPick
let activeQP : vscode.QuickPick<AllQPItemVariants> | undefined;
let previousActiveEditor: vscode.TextEditor | undefined;

export const periscope = () => {
  let qp: vscode.QuickPick<AllQPItemVariants>;
  let workspaceFolders = vscode.workspace.workspaceFolders;
  let query = '';
  let highlightDecoration = highlightDecorationType();
  let spawnProcess: ChildProcessWithoutNullStreams | undefined;
  let config = getConfig();
  let rgMenuActionsSelected: string[] = [];
  let disposables: DisposablesMap = {
    general: [],
    rgMenuActions: [],
    query: [],
  };

  function register() {
    setActiveContext(true);
    console.log('PERISCOPE: start');
    config = getConfig();
    workspaceFolders = vscode.workspace.workspaceFolders;
    previousActiveEditor = vscode.window.activeTextEditor;
    // @see https://code.visualstudio.com/api/references/vscode-api#QuickPick
    qp = vscode.window.createQuickPick();
    activeQP = qp;

    // if ripgrep actions are available then open preliminary quickpick
    const openRgMenuActions = config.alwaysShowRgMenuActions && config.rgMenuActions.length > 0;
    openRgMenuActions ? setupRgMenuActions() : setupQuickPickForQuery();

    disposables.general.push(
      qp.onDidHide(onDidHide)
    );
    qp.show();
  }

  function disposeAll() {
    disposables.general.forEach(d => d.dispose());
    disposables.rgMenuActions.forEach(d => d.dispose());
    disposables.query.forEach(d => d.dispose());
  }

  function reset() {
    checkKillProcess();
    disposables.rgMenuActions.forEach(d => d.dispose());
    disposables.query.forEach(d => d.dispose());
    qp.busy = false;
    qp.value = '';
    query = '';
    rgMenuActionsSelected = [];
  }

  // when ripgrep actions are available show preliminary quickpick for those options to add to the query
  function setupRgMenuActions() {
    reset();

    qp.placeholder = '🫧 Select actions or type custom rg options (Space key to check/uncheck)';
    qp.canSelectMany = true;

    // add items from the config
    qp.items = config.rgMenuActions.map(({value, label}) => ({ 
      _type: 'QuickPickItemRgMenuAction',
      label: label || value,
      description: label ? value : undefined,
      data: {
        rgOption: value,
      }
     })
    );

    function next() {
      rgMenuActionsSelected = (qp.selectedItems as QPItemRgMenuAction[]).map(item => item.data.rgOption);

      // if no actions selected, then use the current query as a custom command to rg
      if (!rgMenuActionsSelected.length && qp.value) {
        rgMenuActionsSelected.push(qp.value);
        qp.value = '';
      }

      setupQuickPickForQuery();
    }

    disposables.rgMenuActions.push(
      qp.onDidTriggerButton(next),
      qp.onDidAccept(next)
    );
  }

  // update quickpick event listeners for the query
  function setupQuickPickForQuery() {
    qp.placeholder = '🫧';
    qp.items = [];
    qp.canSelectMany = false;
    qp.value = getSelectedText();
    disposables.query.push(
      qp.onDidChangeValue(onDidChangeValue),
      qp.onDidChangeActive(onDidChangeActive),
      qp.onDidAccept(onDidAccept),
      qp.onDidTriggerItemButton(onDidTriggerItemButton)
    );
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

      // Jump to rg menu actions
      if (
        config.gotoRgMenuActionsPrefix &&
        value.startsWith(config.gotoRgMenuActionsPrefix)
      ) {
        setupRgMenuActions();
        return;
      }

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
      qp.items = [];
    }
  }

  // when item is 'FOCUSSED'
  function onDidChangeActive(items: readonly AllQPItemVariants[]) {
    peekItem(items as readonly QPItemQuery[]);
  }

  // when item is 'SELECTED'
  function onDidAccept() {
    accept();
  }

  // when item button is 'TRIGGERED'
  function onDidTriggerItemButton(e: vscode.QuickPickItemButtonEvent<QPItemQuery>) {
    console.log('PERISCOPE: item button triggered');
    if (e.item._type === 'QuickPickItemQuery') {
      accept(e.item as QPItemQuery);
    }
  }

  // when prompt is 'CANCELLED'
  function onDidHide() {
    if (!qp.selectedItems[0]) {
      if (previousActiveEditor) {
        vscode.window.showTextDocument(
          previousActiveEditor.document,
          previousActiveEditor.viewColumn
        );
      }
    }

    finished();
  }

  function search(value: string) {
    qp.busy = true;
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
        qp.items = searchResultLines
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
          .filter(Boolean) as QPItemQuery[];
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
      qp.busy = false;
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

  function peekItem(items: readonly QPItemQuery[]) {
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

  function accept(item?: QPItemQuery) {
    const currentItem = item ? item : qp.selectedItems[0] as QPItemQuery;
    if (!currentItem?.data) {
      return;
    }

    const { filePath, linePos, colPos } = currentItem.data;
    vscode.workspace.openTextDocument(filePath).then(document => {
      const options: vscode.TextDocumentShowOptions = {};

      if(item) { // horizontal split
        options.viewColumn = vscode.ViewColumn.Beside;
        previousActiveEditor = undefined; // prevent focus previous editor
      }

      vscode.window.showTextDocument(document, options).then(editor => {
        setPos(editor, linePos, colPos);
        qp.dispose();
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
  ): QPItemQuery {
    return {
      _type: 'QuickPickItemQuery',
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
      buttons: [
        {
          iconPath: new vscode.ThemeIcon('split-horizontal'),
          tooltip: 'Open in Horizontal split',
        },
      ],
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
    qp.hide();
  }

  function finished() {
    checkKillProcess();
    highlightDecoration.remove();
    setActiveContext(false);
    disposeAll();
    activeQP = undefined;
    previousActiveEditor = undefined;
    console.log('PERISCOPE: finished');
  }

  return {
    register,
  };
};

// Open the current qp selected item in a horizontal split
export const openInHorizontalSplit = () => {
  if(!activeQP) {
    return;
  }

  // grab the current selected item
  const currentItem = activeQP.activeItems[0] as QPItemQuery;

  if (!currentItem?.data) {
    return;
  }

  const options: vscode.TextDocumentShowOptions = {
    viewColumn: vscode.ViewColumn.Beside,
  };

  const { filePath, linePos, colPos } = currentItem.data;
  vscode.workspace.openTextDocument(filePath).then(document => {
      vscode.window.showTextDocument(document, options).then(editor => {
          // set cursor & view position
          const position = new vscode.Position(linePos, colPos);
          editor.revealRange(new vscode.Range(position, position));
          previousActiveEditor = undefined; // prevent focus previous editor
          activeQP?.dispose();
      });
  });
};

