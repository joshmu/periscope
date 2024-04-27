import * as vscode from 'vscode';
import { AllQPItemVariants, QPItemQuery, QPItemRgMenuAction } from "../types";
import { openNativeVscodeSearch, peekItem } from "./editorActions";
import { checkKillProcess, extraRgFlagsFromQuery, search } from "./ripgrep";
import { context as cx } from './context';
import { getSelectedText } from "../utils/getSelectedText";
import { log } from '../utils/log';
import { previousActiveEditor } from './editorContext';
import { accept, finished } from './globalActions';

// update quickpick event listeners for the query
export function setupQuickPickForQuery() {
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

export function reset() {
  checkKillProcess();
  cx.disposables.rgMenuActions.forEach(d => d.dispose());
  cx.disposables.query.forEach(d => d.dispose());
  cx.qp.busy = false;
  cx.qp.value = '';
  cx.query = '';
  cx.rgMenuActionsSelected = [];
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
export function onDidHide() {
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


// when ripgrep actions are available show preliminary quickpick for those options to add to the query
export function setupRgMenuActions() {
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
