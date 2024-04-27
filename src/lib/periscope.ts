import * as vscode from 'vscode';
import { updatePreviousActiveEditor } from './editorContext';
import { log } from '../utils/log';
import { context as cx } from './context';
import { onDidHide, setupQuickPickForQuery, setupRgMenuActions } from './quickpickActions';
import { setActiveContext } from './globalActions';
import { openInHorizontalSplit } from './editorActions';

function search() {
  cx.resetContext();
  log('start');

  setActiveContext(true);
  updatePreviousActiveEditor(vscode.window.activeTextEditor);

  // if ripgrep actions are available then open preliminary quickpick
  const openRgMenuActions = cx.config.alwaysShowRgMenuActions && cx.config.rgMenuActions.length > 0;
  openRgMenuActions ? setupRgMenuActions() : setupQuickPickForQuery();

  cx.disposables.general.push(
    cx.qp.onDidHide(onDidHide)
  );
  cx.qp.show();
}

export const PERISCOPE = {
  search,
  openInHorizontalSplit
};