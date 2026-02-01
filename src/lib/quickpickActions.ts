import * as vscode from 'vscode';
import {
  AllQPItemVariants,
  QPItemBuffer,
  QPItemFile,
  QPItemQuery,
  QPItemRgMenuAction,
} from '../types';
import { openNativeVscodeSearch, peekItem, peekBufferItem } from './editorActions';
import { checkKillProcess, checkAndExtractRgFlagsFromQuery, rgSearch } from './ripgrep';
import { context as cx, updateAppState } from './context';
import { getSelectedText } from '../utils/getSelectedText';
import { log } from '../utils/log';
import { confirm, confirmBuffer, finished } from './globalActions';
import { saveQuery } from './storage';
import { setSearchMode, resetSearchMode } from '../utils/searchCurrentFile';
import { createBufferItem } from '../utils/quickpickUtils';

// update quickpick event listeners for the query
export function setupQuickPickForQuery(initialQuery: string = '') {
  // Placeholder is already set by setSearchMode, don't override it
  cx.qp.items = [];
  cx.qp.canSelectMany = false;
  cx.qp.value = initialQuery || getSelectedText();
  cx.disposables.query.push(
    cx.qp.onDidChangeValue(onDidChangeValue),
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
  resetSearchMode();
}

// when input query 'CHANGES'
function onDidChangeValue(value: string) {
  checkKillProcess();

  if (!value) {
    cx.qp.items = [];
    return;
  }

  // Check if user wants to search for files using --files flag
  const hasFilesFlag = value.includes('--files');

  // If --files flag is present and we're not already in file search mode, switch to it
  if (hasFilesFlag && cx.searchMode !== 'files') {
    setSearchMode('files');
  } else if (
    !hasFilesFlag &&
    cx.searchMode === 'files' &&
    !cx.injectedRgFlags.includes('--files')
  ) {
    // If --files was removed and we're in file mode (but not from injected flags), switch back
    resetSearchMode();
  }

  // Remove --files from the query as it's handled by search mode
  const cleanedValue = hasFilesFlag ? value.replace('--files', '').trim() : value;

  // update the query if rgQueryParams are available and found
  const { rgQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery(cleanedValue);
  cx.query = rgQuery;

  // jump to rg custom menu if the prefix is found in the query
  if (cx.config.gotoRgMenuActionsPrefix && value.startsWith(cx.config.gotoRgMenuActionsPrefix)) {
    setupRgMenuActions(value.substring(cx.config.gotoRgMenuActionsPrefix.length));
    return;
  }

  // jump to native vscode search if the suffix is found in the query
  if (
    cx.config.enableGotoNativeSearch &&
    cx.config.gotoNativeSearchSuffix &&
    value.endsWith(cx.config.gotoNativeSearchSuffix)
  ) {
    openNativeVscodeSearch(rgQuery, cx.qp);
    return;
  }

  // update the quickpick title with a preview of the rgQueryParam command if utilised
  if (cx.config.rgQueryParamsShowTitle && cx.searchMode !== 'files') {
    cx.qp.title = getRgQueryParamsTitle(rgQuery, extraRgFlags);
  }

  // Perform search using the unified function
  rgSearch(rgQuery, extraRgFlags);

  // Save the query for resume functionality
  if (rgQuery.trim()) {
    saveQuery(cx.extensionContext, rgQuery);
  }
}

// when item is 'FOCUSSED'
function onDidChangeActive(items: readonly AllQPItemVariants[]) {
  // Filter to only pass items that can be peeked (QPItemQuery or QPItemFile)
  const peekableItems = items.filter(
    (item) => item._type === 'QuickPickItemQuery' || item._type === 'QuickPickItemFile',
  );
  if (peekableItems.length > 0) {
    peekItem(peekableItems as readonly (QPItemQuery | QPItemFile)[]);
  }
}

// when item is 'SELECTED'
function onDidAccept() {
  confirm();
}

// when item button is 'TRIGGERED'
// this is the rightmost button on the quickpick item
function onDidTriggerItemButton(e: vscode.QuickPickItemButtonEvent<AllQPItemVariants>) {
  log('item button triggered');
  if (e.item._type === 'QuickPickItemQuery' || e.item._type === 'QuickPickItemFile') {
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
      vscode.window.showTextDocument(
        cx.previousActiveEditor.document,
        cx.previousActiveEditor.viewColumn,
      );
    }
  }

  finished();
}

// when ripgrep actions are available show preliminary quickpick for those options to add to the query
export function setupRgMenuActions(initialQuery: string = '') {
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
    cx.rgMenuActionsSelected = (cx.qp.selectedItems as QPItemRgMenuAction[]).map(
      (item) => item.data.rgOption,
    );

    // if no actions selected, then use the current query as a custom command to rg
    if (!cx.rgMenuActionsSelected.length && cx.qp.value) {
      cx.rgMenuActionsSelected.push(cx.qp.value);
      cx.qp.value = '';
    }

    setupQuickPickForQuery(initialQuery);
  }

  cx.disposables.rgMenuActions.push(cx.qp.onDidTriggerButton(next), cx.qp.onDidAccept(next));
}

// get rgQueryParams info title
export function getRgQueryParamsTitle(rgQuery: string, extraRgFlags: string[]): string | undefined {
  // don't bother showing if there are no extraRgFlags
  if (!extraRgFlags.length) {
    return undefined;
  }

  // hint in the title the expanded rgQueryParams command
  return `rg '${rgQuery}' ${extraRgFlags.join(' ')}`;
}

// setup QuickPick for buffer list (open documents)
export function setupQuickPickForBufferList() {
  cx.qp.items = [];
  cx.qp.canSelectMany = false;
  cx.qp.value = '';

  // Get all open text documents and create buffer items
  const bufferItems = getOpenBufferItems();
  cx.qp.items = bufferItems;

  cx.disposables.query.push(
    cx.qp.onDidChangeValue(onDidChangeValueBufferList),
    cx.qp.onDidChangeActive(onDidChangeActiveBufferList),
    cx.qp.onDidAccept(onDidAcceptBufferList),
    cx.qp.onDidTriggerItemButton(onDidTriggerItemButtonBufferList),
  );
}

// Get all open buffer items
function getOpenBufferItems(): QPItemBuffer[] {
  const documents = vscode.workspace.textDocuments;
  return documents
    .filter((doc) => !doc.uri.scheme.startsWith('output') && doc.uri.scheme !== 'debug')
    .map((doc) => createBufferItem(doc));
}

// Filter buffer items based on query
function onDidChangeValueBufferList(value: string) {
  const allBuffers = getOpenBufferItems();

  if (!value) {
    cx.qp.items = allBuffers;
    return;
  }

  // Filter buffers based on query (case-insensitive matching on label and detail)
  const query = value.toLowerCase();
  const filteredBuffers = allBuffers.filter((item) => {
    const labelMatch = item.label?.toLowerCase().includes(query);
    const detailMatch = item.detail?.toLowerCase().includes(query);
    const descMatch = item.description?.toLowerCase().includes(query);
    return labelMatch || detailMatch || descMatch;
  });

  cx.qp.items = filteredBuffers;
}

// Preview buffer when navigating
function onDidChangeActiveBufferList(items: readonly AllQPItemVariants[]) {
  const bufferItems = items.filter(
    (item) => item._type === 'QuickPickItemBuffer',
  ) as readonly QPItemBuffer[];

  if (bufferItems.length > 0) {
    peekBufferItem(bufferItems);
  }
}

// Open buffer when selected
function onDidAcceptBufferList() {
  confirmBuffer();
}

// Handle item button trigger for buffer list
function onDidTriggerItemButtonBufferList(e: vscode.QuickPickItemButtonEvent<AllQPItemVariants>) {
  log('buffer item button triggered');
  if (e.item._type === 'QuickPickItemBuffer') {
    confirmBuffer({
      context: 'openInHorizontalSplit',
      item: e.item,
    });
  }
}
