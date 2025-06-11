import { context as cx } from '../lib/context';

export function setCurrentFileContext() {
  cx.currentFileOnly = true;
  cx.qp.title = 'Search current file only';
}

export function getCurrentFilePath() {
  return cx.previousActiveEditor?.document.uri.fsPath;
}
