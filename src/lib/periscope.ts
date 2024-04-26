import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { getSelectedText } from '../utils/getSelectedText';
import { tryJsonParse } from '../utils/jsonUtils';
import { AllQPItemVariants, QPItemQuery, QPItemRgMenuAction, RgLine } from '../types';
import { previousActiveEditor,  updatePreviousActiveEditor } from './editorContext';
import { updateActiveQP } from './quickpickContext';
import { closePreviewEditor, openNativeVscodeSearch, setCursorPosition } from './editorActions';
import { log, notifyError } from '../utils/log';
import { formatPathLabel } from '../utils/formatPathLabel';
import { context as cx } from './context';
import { rgCommand } from './ripgrep';

export const periscope = () => {
  // fresh context
  cx.resetContext();

  function register() {
    // fresh context
    cx.resetContext();
    log('start');

    setActiveContext(true);
    updatePreviousActiveEditor(vscode.window.activeTextEditor);
    // todo: check whether we actually need activeQP?
    updateActiveQP(cx.qp);

    // if ripgrep actions are available then open preliminary quickpick
    const openRgMenuActions = cx.config.alwaysShowRgMenuActions && cx.config.rgMenuActions.length > 0;
    openRgMenuActions ? setupRgMenuActions() : setupQuickPickForQuery();

    cx.disposables.general.push(
      cx.qp.onDidHide(onDidHide)
    );
    cx.qp.show();
  }

  function disposeAll() {
    cx.disposables.general.forEach(d => d.dispose());
    cx.disposables.rgMenuActions.forEach(d => d.dispose());
    cx.disposables.query.forEach(d => d.dispose());
  }

  function reset() {
    checkKillProcess();
    cx.disposables.rgMenuActions.forEach(d => d.dispose());
    cx.disposables.query.forEach(d => d.dispose());
    cx.qp.busy = false;
    cx.qp.value = '';
    cx.query = '';
    cx.rgMenuActionsSelected = [];
  }

  // when ripgrep actions are available show preliminary quickpick for those options to add to the query
  function setupRgMenuActions() {
    reset();
    cx.qp.placeholder = '🫧 Select actions or type custom rg options (Space key to check/uncheck)';
    cx.qp.canSelectMany = true;

    // add items from the config
    cx.qp.items = cx.config.rgMenuActions.map(({value, label}) => ({ 
      _type: 'QuickPickItemRgMenuAction',
      label: label ?? value,
      description: label ? value : undefined,
      data: {
        rgOption: value,
      }
     })
    );

    function next() {
      cx.rgMenuActionsSelected = (cx.qp.selectedItems as QPItemRgMenuAction[]).map(item => item.data.rgOption);

      // if no actions selected, then use the current query as a custom command to rg
      if (!cx.rgMenuActionsSelected.length && cx.qp.value) {
        cx.rgMenuActionsSelected.push(cx.qp.value);
        cx.qp.value = '';
      }

      setupQuickPickForQuery();
    }

    cx.disposables.rgMenuActions.push(
      cx.qp.onDidTriggerButton(next),
      cx.qp.onDidAccept(next)
    );
  }

  // update quickpick event listeners for the query
  function setupQuickPickForQuery() {
    cx.qp.placeholder = '🫧';
    cx.qp.items = [];
    cx.qp.canSelectMany = false;
    cx.qp.value = getSelectedText();
    cx.disposables.query.push(
      cx.qp.onDidChangeValue(onDidChangeValue),
      cx.qp.onDidChangeActive(onDidChangeActive),
      cx.qp.onDidAccept(onDidAccept),
      cx.qp.onDidTriggerItemButton(onDidTriggerItemButton)
    );
  }

  // create vscode context for the extension for targeted keybindings
  function setActiveContext(flag: boolean) {
    log(`setContext ${flag}`);
    vscode.commands.executeCommand('setContext', 'periscopeActive', flag);
  }

  // when input query 'CHANGES'
  function onDidChangeValue(value: string) {
    checkKillProcess();

    if (value) {
      cx.query = value;

      // Jump to rg menu actions
      if (
        cx.config.gotoRgMenuActionsPrefix &&
        value.startsWith(cx.config.gotoRgMenuActionsPrefix)
      ) {
        setupRgMenuActions();
        return;
      }

      // Jump to native vscode search option
      if (
        cx.config.enableGotoNativeSearch &&
        cx.config.gotoNativeSearchSuffix &&
        value.endsWith(cx.config.gotoNativeSearchSuffix)
      ) {
        openNativeVscodeSearch(cx.query, cx.qp);
        return;
      }

      if(cx.config.rgQueryParams.length > 0) {
        const { newQuery, extraRgFlags } = extraRgFlagsFromQuery(value);
        cx.query = newQuery; // update query for later use

        if(cx.config.rgQueryParamsShowTitle) { // update title with preview
          cx.qp.title = extraRgFlags.length > 0 ? `rg '${cx.query}' ${extraRgFlags.join(' ')}` : undefined;
        }

        search(newQuery, extraRgFlags);
      } else {
        search(value);
      }
    } else {
      cx.qp.items = [];
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
    log('item button triggered');
    if (e.item._type === 'QuickPickItemQuery') {
      accept(e.item);
    }
  }

  // when prompt is 'CANCELLED'
  function onDidHide() {
    if (!cx.qp.selectedItems[0]) {
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
    cx.qp.busy = true;
    const rgCmd = rgCommand(value, rgExtraFlags);
    log('rgCmd:', rgCmd);
    checkKillProcess();
    let searchResults: any[] = [];

    const spawnProcess = spawn(rgCmd, [], { shell: true });
    cx.spawnRegistry.push(spawnProcess);
    
    spawnProcess.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);

      for (const line of lines) {
          const parsedLine = tryJsonParse<RgLine>(line);

          if (parsedLine?.type === 'match') {
              // eslint-disable-next-line @typescript-eslint/naming-convention
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
      const errorMsg = data.toString();

      // additional UI feedback for common errors
      if (errorMsg.includes('unrecognized')) {
        cx.qp.title = errorMsg;
      }

      log.error(data.toString());
      handleNoResultsFound();
    });
    spawnProcess.on('exit', (code: number) => {
      if (code === 0 && searchResults.length) {
        cx.qp.items = searchResults
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
      } else if (code === null || code === 0) {
        // do nothing if no code provided or process is success but nothing needs to be done
        log('Nothing to do...');
        return;
      } else if (code === 127) {
        notifyError(`PERISCOPE: Ripgrep exited with code ${code} (Ripgrep not found. Please install ripgrep)`);
      } else if (code === 1) {
        log(`Ripgrep exited with code ${code} (no results found)`);
        handleNoResultsFound();
      } else if (code === 2) {
        log.error(`Ripgrep exited with code ${code} (error during search operation)`);
      } else {
        const msg = `Ripgrep exited with code ${code}`;
        log.error(msg);
        notifyError(`PERISCOPE: ${msg}`);
      }
      cx.qp.busy = false;
    });
  }

  function handleNoResultsFound() {
    if (cx.config.showPreviousResultsWhenNoMatches) {
      return;
    }

    // hide the previous results if no results found
    cx.qp.items = [];
    // no peek preview available, show the origin document instead
    showPreviewOfOriginDocument();
  }

  function showPreviewOfOriginDocument() {
    if (!previousActiveEditor) {return;}
    vscode.window.showTextDocument(previousActiveEditor.document, {
      preserveFocus: true,
      preview: true
    });
  }

  function checkKillProcess() {
    const {spawnRegistry} = cx;
    spawnRegistry.forEach(spawnProcess => {
      spawnProcess.stdout.destroy();
      spawnProcess.stderr.destroy();
      spawnProcess.kill();
    });

    // check if spawn process is no longer running and if so remove from registry
    cx.spawnRegistry = spawnRegistry.filter(spawnProcess => {
      return !spawnProcess.killed;
    });
  }

  // extract rg flags from the query, can match multiple regex's
  function extraRgFlagsFromQuery(query: string): {
    newQuery: string;
    extraRgFlags: string[];
  } {
    const extraRgFlags: string[] = [];
    const queries = [query];

    for (const { param, regex } of cx.config.rgQueryParams) {
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
          setCursorPosition(editor, linePos, colPos);
        });
    });
  }

  function accept(item?: QPItemQuery) {
    checkKillProcess();

    const currentItem = item ? item : cx.qp.selectedItems[0] as QPItemQuery;
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
        setCursorPosition(editor, linePos, colPos);
        cx.qp.dispose();
      });
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

  function finished() {
    checkKillProcess();
    cx.highlightDecoration.remove();
    setActiveContext(false);
    disposeAll();
    updateActiveQP(undefined);
    updatePreviousActiveEditor(undefined);
    log('finished');
  }

  return {
    register,
  };
};

