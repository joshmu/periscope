import { context as cx } from '../lib/context';
import { SearchMode } from '../types';

/**
 * Centralized function to set search mode and update UI accordingly
 */
export function setSearchMode(mode: SearchMode) {
  cx.searchMode = mode;
  updateSearchModeUI(mode);
}

/**
 * Update UI elements based on search mode and injected flags
 */
function updateSearchModeUI(mode: SearchMode) {
  // Handle specific search modes first
  switch (mode) {
    case 'currentFile':
      cx.qp.title = 'Search current file only';
      cx.qp.placeholder = '🫧 Search in current file...';
      break;
    case 'files':
      cx.qp.title = 'File Search';
      cx.qp.placeholder = '🫧 Search for files...';
      break;
    case 'buffers':
      cx.qp.title = 'Search Buffers';
      cx.qp.placeholder = '🫧 Filter open buffers...';
      break;
    case 'all':
    default:
      // Show injected flags in title if any are present (and not already handled by mode)
      if (cx.injectedRgFlags && cx.injectedRgFlags.length > 0 && mode === 'all') {
        cx.qp.title = `Search [${cx.injectedRgFlags.join(' ')}]`;
        cx.qp.placeholder = '🫧';
      } else {
        cx.qp.title = undefined;
        cx.qp.placeholder = '🫧';
      }
      break;
  }
}

/**
 * Reset search mode to default
 */
export function resetSearchMode() {
  setSearchMode('all');
}

export function getCurrentFilePath() {
  return cx.previousActiveEditor?.document.uri.fsPath;
}
