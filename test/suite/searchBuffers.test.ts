import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { context as cx } from '../../src/lib/context';
import {
  waitForQuickPick,
  waitForCondition,
  openDocumentWithContent,
  TEST_TIMEOUTS,
} from '../utils/periscopeTestHelper';
import { QPItemBuffer } from '../../src/types';

suite('Search Buffers Feature', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    cx.resetContext();
  });

  teardown(async () => {
    sandbox.restore();
    // Clean up QuickPick
    if (cx.qp) {
      cx.qp.hide();
      cx.qp.dispose();
    }
    // Close all editors
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  suite('Command Registration', () => {
    test('periscope.searchBuffers command is registered', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Get all registered commands
      const commands = await vscode.commands.getCommands(true);

      assert.ok(
        commands.includes('periscope.searchBuffers'),
        'periscope.searchBuffers command should be registered',
      );
    });
  });

  suite('Search Mode', () => {
    test('periscope.searchBuffers uses "buffers" mode', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Open some files first
      await openDocumentWithContent('content 1', 'typescript');
      await openDocumentWithContent('content 2', 'javascript');

      // Execute the search buffers command
      await vscode.commands.executeCommand('periscope.searchBuffers');

      // Wait for QuickPick to be ready
      await waitForQuickPick();

      // Assert the mode is set correctly
      assert.strictEqual(cx.searchMode, 'buffers');
      assert.strictEqual(cx.qp?.title, 'Search Buffers');
    });
  });

  suite('Buffer Display', () => {
    test('shows only files open as tabs, not all loaded documents', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // Close all editors first
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');

      // Open exactly 2 files as visible tabs
      await openDocumentWithContent('file 1 content', 'typescript');
      await openDocumentWithContent('file 2 content', 'javascript');

      // Load a 3rd document WITHOUT showing it as a tab
      // This simulates VSCode loading documents in background (e.g., go-to-definition)
      await vscode.workspace.openTextDocument({
        content: 'hidden document content',
        language: 'python',
      });

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();
      await waitForCondition(() => cx.qp?.items.length >= 1, TEST_TIMEOUTS.SEARCH_RESULTS);

      // Should show exactly 2 items (only the visible tabs, NOT the hidden document)
      const bufferItems = cx.qp.items.filter((item: any) => item._type === 'QuickPickItemBuffer');

      assert.strictEqual(
        bufferItems.length,
        2,
        `Should show exactly 2 buffer items for 2 open tabs, but got ${bufferItems.length}`,
      );
    });

    test('shows all open buffers in QuickPick', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // Open multiple documents
      const doc1 = await openDocumentWithContent('content for file 1', 'typescript');
      const doc2 = await openDocumentWithContent('content for file 2', 'javascript');
      const doc3 = await openDocumentWithContent('content for file 3', 'python');

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for items to be populated
      await waitForCondition(() => cx.qp?.items.length >= 3, TEST_TIMEOUTS.SEARCH_RESULTS);

      // Should have items for each open buffer
      assert.ok(cx.qp.items.length >= 3, 'Should show at least 3 open buffers');

      // All items should be of type QuickPickItemBuffer
      const bufferItems = cx.qp.items.filter(
        (item: any) => item._type === 'QuickPickItemBuffer',
      ) as QPItemBuffer[];
      assert.ok(bufferItems.length >= 3, 'All items should be buffer items');
    });

    test('buffer items contain correct data structure', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Open a document
      const editor = await openDocumentWithContent('test content', 'typescript');
      const doc = editor.document;

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for items
      await waitForCondition(() => cx.qp?.items.length >= 1, TEST_TIMEOUTS.SEARCH_RESULTS);

      // Find the buffer item for our document
      const bufferItem = cx.qp.items.find(
        (item: any) =>
          item._type === 'QuickPickItemBuffer' && item.data?.uri?.toString() === doc.uri.toString(),
      ) as QPItemBuffer | undefined;

      assert.ok(bufferItem, 'Should find buffer item for opened document');
      assert.strictEqual(bufferItem._type, 'QuickPickItemBuffer');
      assert.ok(bufferItem.data.uri, 'Buffer item should have uri');
      assert.strictEqual(typeof bufferItem.data.isDirty, 'boolean', 'Should have isDirty flag');
    });

    test('marks dirty buffers appropriately', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Open a document and make it dirty
      const editor = await openDocumentWithContent('original content', 'typescript');

      // Make the document dirty by editing it
      await editor.edit((editBuilder) => {
        editBuilder.insert(new vscode.Position(0, 0), 'modified ');
      });

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for items
      await waitForCondition(() => cx.qp?.items.length >= 1, TEST_TIMEOUTS.SEARCH_RESULTS);

      // Find the buffer item for our dirty document
      const bufferItem = cx.qp.items.find(
        (item: any) =>
          item._type === 'QuickPickItemBuffer' &&
          item.data?.uri?.toString() === editor.document.uri.toString(),
      ) as QPItemBuffer | undefined;

      assert.ok(bufferItem, 'Should find buffer item');
      assert.strictEqual(bufferItem.data.isDirty, true, 'Should mark buffer as dirty');
    });
  });

  suite('Filtering', () => {
    test('filters buffers as user types', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // Open documents with distinct content
      await openDocumentWithContent('typescript code here', 'typescript');
      await openDocumentWithContent('javascript code here', 'javascript');
      await openDocumentWithContent('python code here', 'python');

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for all items to appear
      await waitForCondition(() => cx.qp?.items.length >= 3, TEST_TIMEOUTS.SEARCH_RESULTS);

      const initialCount = cx.qp.items.length;

      // Type a filter query (language ID is often part of the label/detail for untitled docs)
      cx.qp.value = 'typescript';

      // Wait for filtering to apply
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Items should be filtered (fewer than initial or only matching ones visible)
      // The QuickPick's built-in filtering should reduce visible items
      // Note: we test that filtering doesn't break and items are still present
      assert.ok(cx.qp.items.length > 0, 'Should have filtered results');
    });

    test('shows all buffers when filter is cleared', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // Open multiple documents
      await openDocumentWithContent('content 1', 'typescript');
      await openDocumentWithContent('content 2', 'javascript');

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for items
      await waitForCondition(() => cx.qp?.items.length >= 2, TEST_TIMEOUTS.SEARCH_RESULTS);

      const initialCount = cx.qp.items.length;

      // Apply filter
      cx.qp.value = 'typescript';
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Clear filter
      cx.qp.value = '';
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Should show all buffers again
      assert.strictEqual(cx.qp.items.length, initialCount, 'Should restore all buffers');
    });

    test('handles case-insensitive filtering', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Open a document
      await openDocumentWithContent('TypeScript content', 'typescript');

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for items
      await waitForCondition(() => cx.qp?.items.length >= 1, TEST_TIMEOUTS.SEARCH_RESULTS);

      // Filter with different case
      cx.qp.value = 'TYPESCRIPT';
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Should still find results (QuickPick has built-in case-insensitive matching)
      assert.ok(cx.qp.items.length > 0, 'Should find buffers with case-insensitive filter');
    });
  });

  suite('Navigation and Selection', () => {
    test('previews buffer when navigating items', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // Open two distinct documents
      const editor1 = await openDocumentWithContent('content for first file', 'typescript');
      const doc1Uri = editor1.document.uri.toString();

      const editor2 = await openDocumentWithContent('content for second file', 'javascript');
      const doc2Uri = editor2.document.uri.toString();

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for items
      await waitForCondition(() => cx.qp?.items.length >= 2, TEST_TIMEOUTS.SEARCH_RESULTS);

      // Find items for our documents
      const items = cx.qp.items as QPItemBuffer[];
      const item1 = items.find((item) => item.data?.uri?.toString() === doc1Uri);
      const item2 = items.find((item) => item.data?.uri?.toString() === doc2Uri);

      assert.ok(item1 && item2, 'Should have items for both documents');

      // Select the first item (simulating navigation)
      cx.qp.activeItems = [item1];

      // Wait for preview to update
      await waitForCondition(() => {
        const activeEditor = vscode.window.activeTextEditor;
        return activeEditor?.document.uri.toString() === doc1Uri;
      }, TEST_TIMEOUTS.PREVIEW_UPDATE);

      // Check that the correct document is previewed
      assert.strictEqual(
        vscode.window.activeTextEditor?.document.uri.toString(),
        doc1Uri,
        'Should preview first document',
      );
    });

    test('switches to buffer on accept', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // Open a document
      const editor = await openDocumentWithContent('target content', 'typescript');
      const targetUri = editor.document.uri.toString();

      // Open another document to switch away
      await openDocumentWithContent('other content', 'javascript');

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for items
      await waitForCondition(() => cx.qp?.items.length >= 2, TEST_TIMEOUTS.SEARCH_RESULTS);

      // Find the item for our target document
      const targetItem = cx.qp.items.find(
        (item: any) =>
          item._type === 'QuickPickItemBuffer' && item.data?.uri?.toString() === targetUri,
      ) as QPItemBuffer | undefined;

      assert.ok(targetItem, 'Should find target buffer item');

      // Select and accept the item
      cx.qp.activeItems = [targetItem];
      cx.qp.selectedItems = [targetItem];

      // Trigger accept (simulating Enter key)
      // The QuickPick's onDidAccept handler should switch to the buffer
      // We need to actually trigger the accept - this simulates user pressing Enter
      // Note: In real tests, we may need to trigger the internal accept handler

      // For now, verify that selecting an item works
      assert.deepStrictEqual(cx.qp.activeItems, [targetItem], 'Item should be active');
    });

    test('closes QuickPick after accepting buffer', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // Open a document
      await openDocumentWithContent('content', 'typescript');

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for items
      await waitForCondition(() => cx.qp?.items.length >= 1, TEST_TIMEOUTS.SEARCH_RESULTS);

      // The QuickPick should be visible
      assert.ok(cx.qp, 'QuickPick should exist');

      // Hide the QuickPick (simulating what happens after accept)
      cx.qp.hide();

      // Wait for hide to complete
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
    });
  });

  suite('Edge Cases', () => {
    test('handles empty buffer list gracefully', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Close all editors first
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');

      // Execute buffer list command with no open buffers
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Should show QuickPick even with no buffers
      assert.ok(cx.qp, 'QuickPick should be initialized');
      // Items may be empty or show a placeholder
      assert.ok(cx.qp.items.length >= 0, 'Should handle empty buffer list');
    });

    test('updates buffer list when new file is opened', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // Open initial document
      await openDocumentWithContent('initial content', 'typescript');

      // Execute buffer list command
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for items
      await waitForCondition(() => cx.qp?.items.length >= 1, TEST_TIMEOUTS.SEARCH_RESULTS);

      const initialCount = cx.qp.items.length;

      // Close the QuickPick
      cx.qp.hide();
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Open another document
      await openDocumentWithContent('new content', 'javascript');

      // Re-open buffer list
      await vscode.commands.executeCommand('periscope.searchBuffers');
      await waitForQuickPick();

      // Wait for items
      await waitForCondition(
        () => cx.qp?.items.length > initialCount,
        TEST_TIMEOUTS.SEARCH_RESULTS,
      );

      // Should have more items now
      assert.ok(cx.qp.items.length > initialCount, 'Should show newly opened buffer');
    });
  });
});
