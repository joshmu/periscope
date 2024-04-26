// lib/editorContext.ts
import * as vscode from 'vscode';

export let previousActiveEditor: vscode.TextEditor | undefined;

export function updatePreviousActiveEditor(editor: vscode.TextEditor | undefined) {
    previousActiveEditor = editor;
}
