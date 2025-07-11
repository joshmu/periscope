import * as vscode from 'vscode';
import { context as cx } from './context';
import { onDidHide, setupQuickPickForQuery, setupRgMenuActions } from './quickpickActions';
import { start } from './globalActions';
import { openInHorizontalSplit } from './editorActions';
import { setCurrentFileContext } from '../utils/searchCurrentFile';
import { getLastQuery } from './storage';

function search(
  extensionContext?: vscode.ExtensionContext,
  {
    currentFileOnly = false,
    initialQuery = '',
  }: { currentFileOnly?: boolean; initialQuery?: string } = {},
) {
  start();

  // Store the extension context for storage operations
  cx.extensionContext = extensionContext;

  if (currentFileOnly) {
    setCurrentFileContext();
  }

  // if ripgrep actions are available then open preliminary quickpick
  const showRgMenuActions = cx.config.alwaysShowRgMenuActions && cx.config.rgMenuActions.length > 0;
  if (showRgMenuActions) {
    setupRgMenuActions(initialQuery);
  } else {
    setupQuickPickForQuery(initialQuery);
  }

  cx.disposables.general.push(cx.qp.onDidHide(onDidHide));

  // search logic is triggered from the QuickPick event handlers...
  cx.qp.show();
}

function resumeSearch(extensionContext: vscode.ExtensionContext) {
  const lastSearch = getLastQuery(extensionContext);
  if (lastSearch) {
    search(extensionContext, {
      currentFileOnly: lastSearch.type === 'currentFile',
      initialQuery: lastSearch.query,
    });
  } else {
    // No history, just open empty search
    search(extensionContext);
  }
}

export const PERISCOPE = {
  search,
  resumeSearch,
  openInHorizontalSplit,
};
