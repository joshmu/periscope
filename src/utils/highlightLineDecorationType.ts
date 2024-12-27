import * as vscode from 'vscode';
import { getConfig } from './getConfig';

/**
 * Util to create a highlight decoration on matches when 'peeking' at a file
 */
export function initHighlightLineInstance() {
  const {
    peekBorderColor: borderColor,
    peekBorderWidth: borderWidth,
    peekBorderStyle: borderStyle,
  } = getConfig();

  function get() {
    const decorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderWidth: `0 0 ${borderWidth} 0`,
      borderStyle: `${borderStyle}`,
      borderColor,
    });

    return decorationType;
  }
  const decorationType = get();

  function set(editor: vscode.TextEditor) {
    const currentPosition = editor.selection.active;
    const newDecoration = {
      range: new vscode.Range(currentPosition, currentPosition),
    };
    editor.setDecorations(decorationType, [newDecoration]);
  }

  function remove() {
    if (decorationType) {
      vscode.window.activeTextEditor?.setDecorations(decorationType, []);
      decorationType.dispose();
    }
  }

  return {
    set,
    remove,
  };
}
