import * as vscode from 'vscode';
import { getConfig } from './getConfig';

/**
 * Creates highlight decorations for both the current line and matching text when 'peeking' at a file
 */
export function initHighlightLineInstance() {
  const {
    peekBorderColor: borderColor,
    peekBorderWidth: borderWidth,
    peekBorderStyle: borderStyle,
    peekMatchColor: matchColor = 'rgba(255, 255, 0, 0.3)',
  } = getConfig();

  // Create decorations for both line and text match highlighting
  function createDecorationTypes() {
    return {
      line: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        borderWidth: `0 0 ${borderWidth} 0`,
        borderStyle: `${borderStyle}`,
        borderColor,
      }),
      match: vscode.window.createTextEditorDecorationType({
        backgroundColor: matchColor,
        borderRadius: '2px',
      }),
    };
  }

  const decorations = createDecorationTypes();

  /**
   * Apply decorations to highlight both the current line and matching text
   * @param editor Active text editor
   * @param matchRanges Array of {start, end} positions from ripgrep matches
   */
  function set(editor: vscode.TextEditor, matchRanges: Array<{ start: number; end: number }>) {
    const pos = editor.selection.active;

    // Apply line decoration
    editor.setDecorations(decorations.line, [
      {
        range: new vscode.Range(pos, pos),
      },
    ]);

    // Apply match decorations using ripgrep's exact positions
    const matches = matchRanges.map(({ start, end }) => ({
      range: new vscode.Range(pos.line, start, pos.line, end),
    }));
    editor.setDecorations(decorations.match, matches);
  }

  function remove() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.setDecorations(decorations.line, []);
      editor.setDecorations(decorations.match, []);
    }
    decorations.line.dispose();
    decorations.match.dispose();
  }

  return {
    set,
    remove,
  };
}
