import { context as cx } from './context';
import { onDidHide, setupQuickPickForQuery, setupRgMenuActions } from './quickpickActions';
import { start } from './globalActions';
import { openInHorizontalSplit } from './editorActions';

function search() {
  start();

  // if ripgrep actions are available then open preliminary quickpick
  const openRgMenuActions = cx.config.alwaysShowRgMenuActions && cx.config.rgMenuActions.length > 0;
  openRgMenuActions ? setupRgMenuActions() : setupQuickPickForQuery();

  cx.disposables.general.push(
    cx.qp.onDidHide(onDidHide)
  );

  // search logic is triggered from the QuickPick event handlers...
  cx.qp.show();
}

export const PERISCOPE = {
  search,
  openInHorizontalSplit
};