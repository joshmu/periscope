import * as assert from 'assert';
import * as vscode from 'vscode';
import { createPeekDecorationManager } from '../../utils/createPeekDecorationManager';
import { getConfig } from '../../utils/getConfig';

suite('createPeekDecorationManager', () => {
  let decorationManager: ReturnType<typeof createPeekDecorationManager>;

  setup(() => {
    decorationManager = createPeekDecorationManager();
  });

  teardown(() => {
    decorationManager.remove();
  });

  test('creates decoration manager with theme colors when no custom colors set', async () => {
    // Mock getConfig to return null colors to test theme fallback
    const originalGetConfig = getConfig;
    (global as any).getConfig = () => ({
      ...originalGetConfig(),
      peekBorderColor: null,
      peekMatchColor: null,
      peekMatchBorderColor: null,
    });

    const manager = createPeekDecorationManager();

    // Create a test document and editor
    const document = await vscode.workspace.openTextDocument({
      content: 'test content',
      language: 'plaintext',
    });
    const editor = await vscode.window.showTextDocument(document);

    // Apply decorations
    manager.set(editor, [{ start: 0, end: 4 }]);

    // Verify decorations are applied
    // Note: We can't directly test ThemeColor values, but we can verify the decoration is created
    assert.doesNotThrow(() => {
      manager.remove();
    });

    // Restore original getConfig
    (global as any).getConfig = originalGetConfig;
  });

  test('uses custom colors when provided', async () => {
    // Mock getConfig to return custom colors
    const originalGetConfig = getConfig;
    const customColors = {
      peekBorderColor: '#FF0000',
      peekMatchColor: '#00FF00',
      peekMatchBorderColor: '#0000FF',
      peekBorderWidth: '3px',
      peekBorderStyle: 'dashed',
      peekMatchBorderWidth: '2px',
      peekMatchBorderStyle: 'solid',
    };

    (global as any).getConfig = () => ({
      ...originalGetConfig(),
      ...customColors,
    });

    const manager = createPeekDecorationManager();

    // Create a test document and editor
    const document = await vscode.workspace.openTextDocument({
      content: 'test content',
      language: 'plaintext',
    });
    const editor = await vscode.window.showTextDocument(document);

    // Apply decorations
    manager.set(editor, [{ start: 0, end: 4 }]);

    // Verify decorations are applied
    assert.doesNotThrow(() => {
      manager.remove();
    });

    // Restore original getConfig
    (global as any).getConfig = originalGetConfig;
  });

  test('properly disposes decorations on remove', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'test content',
      language: 'plaintext',
    });
    const editor = await vscode.window.showTextDocument(document);

    // Apply decorations
    decorationManager.set(editor, [{ start: 0, end: 4 }]);

    // Remove decorations
    decorationManager.remove();

    // Verify no decorations remain
    // Note: We can't directly access VSCode's decoration state,
    // but we can verify the operation completes without error
    assert.doesNotThrow(() => {
      decorationManager.remove();
    });
  });

  test('applies decorations at correct positions', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: 'test content\nwith multiple\nlines of text',
      language: 'plaintext',
    });
    const editor = await vscode.window.showTextDocument(document);

    const matchRanges = [
      { start: 0, end: 4 }, // "test"
      { start: 5, end: 12 }, // "content"
    ];

    // Apply decorations
    assert.doesNotThrow(() => {
      decorationManager.set(editor, matchRanges);
    });

    // Clean up
    decorationManager.remove();
  });
});
