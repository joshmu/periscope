import * as vscode from 'vscode';
import { AllQPItemVariants, QPItemQuery, QPItemRgMenuAction } from '../types';
import { openNativeVscodeSearch, peekItem } from './editorActions';
import { checkKillProcess, checkAndExtractRgFlagsFromQuery, rgSearch } from './ripgrep';
import { fzfSearch } from './fzfgrep';
import { context as cx, updateAppState } from './context';
import { getSelectedText } from '../utils/getSelectedText';
import { log } from '../utils/log';
import { confirm, finished } from './globalActions';

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
    cx.qp.onDidTriggerItemButton(onDidTriggerItemButton),
  );
}

// update quickpick event listeners for the file search query
export function setupQuickPickForFilesQuery() {
  cx.qp.placeholder = '🫧';
  cx.qp.items = [];
  cx.qp.canSelectMany = false;
  cx.qp.value = getSelectedText();
  cx.disposables.query.push(
    cx.qp.onDidChangeValue(onDidChangeFzfValue),
    cx.qp.onDidChangeActive(onDidChangeActive),
    cx.qp.onDidAccept(onDidAccept),
    cx.qp.onDidTriggerItemButton(onDidTriggerItemButton),
  );
}

export function reset() {
  checkKillProcess();
  cx.disposables.rgMenuActions.forEach((d) => d.dispose());
  cx.disposables.query.forEach((d) => d.dispose());
  cx.qp.busy = false;
  cx.qp.value = '';
  cx.query = '';
  cx.rgMenuActionsSelected = [];
}

// when input query 'CHANGES'
function onDidChangeValue(value: string) {
  checkKillProcess();

  if (!value) {
    cx.qp.items = [];
    return;
  }

  cx.query = value;

  // jump to rg custom menu if the prefix is found in the query
  if (cx.config.gotoRgMenuActionsPrefix && value.startsWith(cx.config.gotoRgMenuActionsPrefix)) {
    setupRgMenuActions();
    return;
  }

  // jump to native vscode search if the suffix is found in the query
  if (
    cx.config.enableGotoNativeSearch &&
    cx.config.gotoNativeSearchSuffix &&
    value.endsWith(cx.config.gotoNativeSearchSuffix)
  ) {
    openNativeVscodeSearch(cx.query, cx.qp);
    return;
  }

  // update the query if rgQueryParams are available and found
  const { updatedQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery(value);

  // update the quickpick title with a preview of the rgQueryParam command if utilised
  if (cx.config.rgQueryParamsShowTitle) {
    cx.qp.title = extraRgFlags.length > 0 ? `rg '${cx.query}' ${extraRgFlags.join(' ')}` : undefined;
  }

  rgSearch(updatedQuery, extraRgFlags);
}

function onDidChangeFzfValue(value: string) {
  checkKillProcess();

  if (!value) {
    cx.qp.items = [];
    return;
  }

  cx.query = value;

  // jump to rg custom menu if the prefix is found in the query
  if (cx.config.gotoRgMenuActionsPrefix && value.startsWith(cx.config.gotoRgMenuActionsPrefix)) {
    setupRgMenuActions();
    return;
  }

  fzfSearch(value);
}

// when item is 'FOCUSSED'
function onDidChangeActive(items: readonly AllQPItemVariants[]) {
  peekItem(items as readonly QPItemQuery[]);
}

// when item is 'SELECTED'
function onDidAccept() {
  confirm();
}

// when item button is 'TRIGGERED'
// this is the rightmost button on the quickpick item
function onDidTriggerItemButton(e: vscode.QuickPickItemButtonEvent<AllQPItemVariants>) {
  log('item button triggered');
  if (e.item._type === 'QuickPickItemQuery') {
    // as there is only horizontal split as an option we can assume this
    confirm({
      context: 'openInHorizontalSplit',
      item: e.item,
    });
  }
}

// when prompt is 'CANCELLED'
export function onDidHide() {
  if (!cx.qp.selectedItems[0]) {
    if (cx.previousActiveEditor) {
      vscode.window.showTextDocument(cx.previousActiveEditor.document, cx.previousActiveEditor.viewColumn);
    }
  }

  finished();
}

// when ripgrep actions are available show preliminary quickpick for those options to add to the query
export function setupRgMenuActions() {
  reset();
  updateAppState('IDLE');
  cx.qp.placeholder = '🫧 Select actions or type custom rg options (Space key to check/uncheck)';
  cx.qp.canSelectMany = true;

  // add items from the config
  cx.qp.items = cx.config.rgMenuActions.map(({ value, label }) => ({
    _type: 'QuickPickItemRgMenuAction',
    label: label ?? value,
    description: label ? value : undefined,
    data: {
      rgOption: value,
    },
  }));

  function next() {
    cx.rgMenuActionsSelected = (cx.qp.selectedItems as QPItemRgMenuAction[]).map((item) => item.data.rgOption);

    // if no actions selected, then use the current query as a custom command to rg
    if (!cx.rgMenuActionsSelected.length && cx.qp.value) {
      cx.rgMenuActionsSelected.push(cx.qp.value);
      cx.qp.value = '';
    }

    setupQuickPickForQuery();
  }

  cx.disposables.rgMenuActions.push(cx.qp.onDidTriggerButton(next), cx.qp.onDidAccept(next));
}
