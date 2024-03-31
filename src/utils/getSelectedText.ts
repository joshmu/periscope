import * as vscode from 'vscode';

// retrieve current highlighted text
export function getSelectedText() {
  let selectedText = '';
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    selectedText = editor.document.getText(editor.selection);
  }
  return selectedText;
}
