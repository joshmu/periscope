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
  // Close any tabs that were opened for preview but not picked by the user
  const tabsToClose: vscode.Tab[] = [];
  const pickedUri = cx.pickedUri;
  const previewUris = cx.previewOpenedUris;
  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (tab.input instanceof vscode.TabInputText) {
        const uriString = tab.input.uri.toString();
        if (previewUris.has(uriString) && uriString !== pickedUri) {
          tabsToClose.push(tab);
        }
      }
    }
  }
  if (tabsToClose.length > 0) {
    vscode.window.tabGroups.close(tabsToClose, true);
  }

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
  cx.qp.canSelectMany = false;
  cx.qp.value = '';
  cx.qp.items = getOpenBufferItems();

  cx.disposables.query.push(
    cx.qp.onDidChangeValue(onDidChangeValueBufferList),
    cx.qp.onDidChangeActive(onDidChangeActiveBufferList),
    cx.qp.onDidAccept(onDidAcceptBufferList),
    cx.qp.onDidTriggerItemButton(onDidTriggerItemButtonBufferList),
  );
}

function isUserDocument(doc: vscode.TextDocument): boolean {
  return !doc.uri.scheme.startsWith('output') && doc.uri.scheme !== 'debug';
}

function getOpenBufferItems(): QPItemBuffer[] {
  const bufferItems: QPItemBuffer[] = [];

  for (const tabGroup of vscode.window.tabGroups.all) {
    for (const tab of tabGroup.tabs) {
      if (tab.input instanceof vscode.TabInputText) {
        const uri = tab.input.uri;
        const document = vscode.workspace.textDocuments.find(
          (doc) => doc.uri.toString() === uri.toString(),
        );
        if (document && isUserDocument(document)) {
          bufferItems.push(createBufferItem(document));
        }
      }
    }
  }

  return bufferItems;
}

function matchesQuery(item: QPItemBuffer, query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return (
    item.label?.toLowerCase().includes(lowerQuery) ||
    item.detail?.toLowerCase().includes(lowerQuery) ||
    item.description?.toLowerCase().includes(lowerQuery) ||
    false
  );
}

function onDidChangeValueBufferList(value: string) {
  const allBuffers = getOpenBufferItems();
  cx.qp.items = value ? allBuffers.filter((item) => matchesQuery(item, value)) : allBuffers;
}

function onDidChangeActiveBufferList(items: readonly AllQPItemVariants[]) {
  const bufferItems = items.filter(
    (item): item is QPItemBuffer => item._type === 'QuickPickItemBuffer',
  );
  if (bufferItems.length > 0) {
    peekBufferItem(bufferItems);
  }
}

function onDidAcceptBufferList() {
  confirmBuffer();
}

function onDidTriggerItemButtonBufferList(e: vscode.QuickPickItemButtonEvent<AllQPItemVariants>) {
  if (e.item._type !== 'QuickPickItemBuffer') {
    return;
  }
  confirmBuffer({ context: 'openInHorizontalSplit', item: e.item });
}
