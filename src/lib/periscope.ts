import { context as cx } from './context';
import { onDidHide, setupQuickPickForQuery, setupRgMenuActions } from './quickpickActions';
import { start } from './globalActions';
import { openInHorizontalSplit } from './editorActions';
import { getSelectedText } from '../utils/getSelectedText';

function search(useSelection = false) {
  start();

  // if ripgrep actions are available then open preliminary quickpick
  const showRgMenuActions = cx.config.alwaysShowRgMenuActions && cx.config.rgMenuActions.length > 0;
  if (showRgMenuActions) {
    setupRgMenuActions();
  } else {
    setupQuickPickForQuery();
  }

  cx.disposables.general.push(cx.qp.onDidHide(onDidHide));

  // search logic is triggered from the QuickPick event handlers...
  cx.qp.show();

  if (useSelection) {
    const selectedText = getSelectedText();
    if (selectedText) {
      cx.qp.value = selectedText;
    }
  }
}

export const PERISCOPE = {
  search,
  searchWithSelection: () => search(true),
  openInHorizontalSplit,
};
