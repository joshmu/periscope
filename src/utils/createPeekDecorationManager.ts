import * as vscode from 'vscode';
import { getConfig } from './getConfig';

/**
 * Creates and manages decorations for both the current line and matching text when 'peeking' at a file
 */
export function createPeekDecorationManager() {
  const {
    peekBorderColor: borderColor,
    peekBorderWidth: borderWidth,
    peekBorderStyle: borderStyle,
    peekMatchColor: matchColor,
    peekMatchBorderColor: matchBorderColor,
    peekMatchBorderWidth: matchBorderWidth = '1px',
    peekMatchBorderStyle: matchBorderStyle = 'solid',
  } = getConfig();

  // Create decorations for both line and text match highlighting
  function createDecorationTypes() {
    // Use theme color for match highlighting if no custom color is set
    const matchBackgroundColor =
      matchColor ?? new vscode.ThemeColor('editor.findMatchHighlightBackground');

    // Use theme color for match border if no custom color is set
    const matchBorderThemeColor =
      matchBorderColor ?? new vscode.ThemeColor('editor.findMatchHighlightBorder');

    // Use theme color for peek border if no custom color is set
    const peekBorderThemeColor =
      borderColor ?? new vscode.ThemeColor('editor.findMatchHighlightBorder');

    return {
      line: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        borderWidth: `0 0 ${borderWidth} 0`,
        borderStyle: `${borderStyle}`,
        borderColor: peekBorderThemeColor,
      }),
      match: vscode.window.createTextEditorDecorationType({
        backgroundColor: matchBackgroundColor,
        borderRadius: '2px',
        borderWidth: matchBorderWidth,
        borderStyle: matchBorderStyle,
        borderColor: matchBorderThemeColor,
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
