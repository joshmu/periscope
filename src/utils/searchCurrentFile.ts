import { context as cx } from '../lib/context';
import { SearchMode } from '../types';

export function setSearchMode(mode: SearchMode) {
  cx.searchMode = mode;

  switch (mode) {
    case 'currentFile':
      cx.qp.title = 'Search current file only';
      break;
    case 'files':
      cx.qp.title = 'File Search';
      break;
    default:
      cx.qp.title = undefined;
  }
}

export function getCurrentFilePath() {
  return cx.previousActiveEditor?.document.uri.fsPath;
}
