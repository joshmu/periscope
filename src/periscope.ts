import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { rgPath } from 'vscode-ripgrep';
import { highlightDecorationType } from './utils/decorationType';
import { getConfig } from './utils/getConfig';
import { getSelectedText } from './utils/getSelectedText';

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

      if(config.rgQueryParams.length > 0) {
        const { newQuery, extraRgFlags } = extraRgFlagsFromQuery(value);
        query = newQuery; // update query for later use

        if(config.rgQueryParamsShowTitle) { // update title with preview
          qp.title = extraRgFlags.length > 0 ? `rg '${query}' ${extraRgFlags.join(' ')}` : undefined;
        }

        search(newQuery, extraRgFlags);
      } else {
        search(value);
      }
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
  function onDidTriggerItemButton(e: vscode.QuickPickItemButtonEvent<AllQPItemVariants>) {
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

  function search(value: string, rgExtraFlags?: string[]) {
    qp.busy = true;
    const rgCmd = rgCommand(value, rgExtraFlags);
    console.log('PERISCOPE: rgCmd:', rgCmd);
    checkKillProcess();
    let searchResults: any[] = [];
    spawnProcess = spawn(rgCmd, [], { shell: true });
    
    spawnProcess.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
          const parsedLine = JSON.parse(line);
          if (parsedLine.type === 'match') {
              const { path, lines, line_number, absolute_offset } = parsedLine.data;
              const filePath = path.text;
              const linePos = line_number;
              let colPos = absolute_offset === 0 ? 1 : absolute_offset + 1;
              const textResult = lines.text.trim();

              const resultItem = {
                  filePath,
                  linePos,
                  colPos,
                  textResult
              };
              searchResults.push(resultItem);
          }
      }
    });

    spawnProcess.stderr.on('data', (data: Buffer) => {
      console.error('PERISCOPE:', data.toString());
    });
    spawnProcess.on('exit', (code: number) => {
      if (code === null) {
        return;
      }
      if (code === 0 && searchResults.length) {
        qp.items = searchResults
          .map(searchResult => {
            // break the filename via regext ':line:col:'
            const {filePath, linePos, colPos, textResult} = searchResult;

            // if all data is not available then remove the item
            if (!filePath || !linePos || !colPos || !textResult) {
              return false;
            }

            return createResultItem(
              filePath,
              textResult,
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
        if(!config.showPreviousResultsWhenNoMatches) {
          // hide the previous results if no results found
          qp.items = [];
        }
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

  function rgCommand(value: string, extraFlags?: string[]) {
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
      ...rgMenuActionsSelected,
      ...rootPaths,
      ...config.addSrcPaths,
      ...(extraFlags || []),
      ...excludes,
    ];

    return `"${rgPath}" "${value}" ${rgFlags.join(' ')}`;
  }

  // extract rg flags from the query, can match multiple regex's
  function extraRgFlagsFromQuery(query: string): {
    newQuery: string;
    extraRgFlags: string[];
  } {
    const extraRgFlags: string[] = [];
    const queries = [query];

    for (const { param, regex } of config.rgQueryParams) {
      if (param && regex) {
        const match = query.match(regex);
        if (match && match.length > 1) {
          let newParam = param;
          for (let i = 2; i < match.length; i++) {
            newParam = newParam.replace(`$${i-1}`, match[i]);
          }
          extraRgFlags.push(newParam);
          queries.push(match[1]);
        }
      }
    }

    // prefer the first query match or the original one
    const newQuery = queries.length > 1 ? queries[1] : queries[0];
    return { newQuery, extraRgFlags };
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
    vscode.workspace.openTextDocument(path.resolve(filePath)).then(document => {
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
    vscode.workspace.openTextDocument(path.resolve(filePath)).then(document => {
      const options: vscode.TextDocumentShowOptions = {};

      if(item) { // horizontal split
        options.viewColumn = vscode.ViewColumn.Beside;
        closePreviewEditor();
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
      const initialFolders = folders.splice(config.startFolderDisplayIndex, config.startFolderDisplayDepth);
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

  closePreviewEditor();

  const { filePath, linePos, colPos } = currentItem.data;
  vscode.workspace.openTextDocument(filePath).then((document) => {
    vscode.window.showTextDocument(document, options).then((editor) => {
      // set cursor & view position
      const position = new vscode.Position(linePos, colPos);
      editor.revealRange(new vscode.Range(position, position));
      activeQP?.dispose();
    });
  });
};

function closePreviewEditor() {
  if(previousActiveEditor) {
    vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    previousActiveEditor = undefined; // prevent focus onDidHide
  }
}

// grap the bundled ripgrep binary from vscode
function ripgrepPath(optionsPath?: string) {
  if(optionsPath?.trim()) {
    return optionsPath.trim();
  }

  return rgPath;
}
