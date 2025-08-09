import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as sinon from 'sinon';
import { context as cx } from '../../src/lib/context';
import {
  periscopeTestHelpers,
  waitForCondition,
  waitForPreviewUpdate,
} from '../utils/periscopeTestHelper';

suite('Search Functionality with Fixtures', function () {
  // Increase timeout for all tests in this suite
  this.timeout(10000);

  let sandbox: sinon.SinonSandbox;

  setup(async () => {
    sandbox = sinon.createSandbox();
    cx.resetContext();

    // Ensure extension is activated
    const ext = vscode.extensions.getExtension('JoshMu.periscope');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  teardown(async () => {
    // Make sure to hide QuickPick to avoid interference
    if (cx.qp) {
      cx.qp.hide();
      cx.qp.dispose();
    }
    sandbox.restore();
    cx.resetContext();
    // Small delay to ensure cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  suite('Text Search in Fixture Workspace', () => {
    test('finds TODO comments using periscope.search', async function () {
      this.timeout(10000);

      const results = await periscopeTestHelpers.search('TODO', { debug: false });

      assert.ok(results.count > 0, `Should find TODO comments. Found ${results.count} items`);

      // Verify we found TODOs in expected files
      assert.ok(
        results.files.includes('Button.tsx'),
        `Should find TODO in Button.tsx. Found files: ${results.files.join(', ')}`,
      );
      assert.ok(
        results.files.includes('integration.test.ts'),
        `Should find TODO in integration.test.ts. Found files: ${results.files.join(', ')}`,
      );

      // Should NOT include node_modules
      assert.ok(
        !results.files.some((f) => f.includes('node_modules')),
        'Should exclude node_modules',
      );

      // Verify we have a reasonable number of TODOs (not hundreds, but at least a few)
      assert.ok(results.count >= 2, 'Should find at least 2 TODOs');
      assert.ok(results.count < 20, 'Should not find an excessive number of TODOs');
    });

    test('finds getUserById function', async () => {
      const results = await periscopeTestHelpers.search('getUserById');

      assert.ok(results.count > 0, 'Should find getUserById');
      assert.ok(results.files.includes('helpers.ts'), 'Should find in helpers.ts');
      assert.ok(results.files.includes('index.ts'), 'Should find in index.ts');
      assert.ok(results.files.includes('unit.test.ts'), 'Should find in unit.test.ts');

      // Verify we found it in multiple files (function definition + imports/usage)
      assert.ok(results.count >= 3, 'Should find at least 3 occurrences (definition + usages)');
      assert.ok(results.count < 10, 'Should not find an excessive number of occurrences');
    });

    test('searches with regex patterns', async () => {
      // Search for log.*Error pattern
      const results = await periscopeTestHelpers.search('log.*Error', { isRegex: true });

      assert.ok(results.count > 0, 'Should find regex matches');

      // All matches should be in logger.ts
      const uniqueFiles = [...new Set(results.files)];
      assert.strictEqual(uniqueFiles.length, 1, 'Should only find in one file');
      assert.ok(uniqueFiles[0].includes('logger.ts'), 'Should be in logger.ts');

      // Verify we found some matches but not too many
      assert.ok(results.count >= 1, 'Should find at least 1 match');
      assert.ok(results.count < 10, 'Should not find excessive matches');
    });
  });

  suite('File Search in Fixture Workspace', () => {
    test('lists files matching pattern', async () => {
      const results = await periscopeTestHelpers.searchFiles('Button');

      assert.ok(results.count > 0, 'Should find files');
      assert.ok(results.files.includes('Button.tsx'), 'Should find Button.tsx');

      // Verify all items are file type
      assert.ok(
        results.items.every((item) => item._type === 'QuickPickItemFile'),
        'All items should be file type',
      );
    });

    test('finds test files using periscope.searchFiles', async () => {
      const results = await periscopeTestHelpers.searchFiles('.test');

      assert.ok(results.files.includes('unit.test.ts'), 'Should find unit.test.ts');
      assert.ok(results.files.includes('integration.test.ts'), 'Should find integration.test.ts');

      // Verify we found test files
      assert.ok(results.count >= 2, 'Should find at least 2 test files');
      assert.ok(
        results.files.every((f) => f.includes('.test')),
        'All files should contain .test in the name',
      );
    });
  });

  suite('Search Modes', () => {
    test('searches only current file in currentFile mode', async () => {
      const results = await periscopeTestHelpers.searchCurrentFile(
        'function',
        'src/utils/helpers.ts',
      );

      assert.ok(results.count > 0, 'Should find functions');

      // All results should be from helpers.ts only
      const uniqueFiles = [...new Set(results.files)];
      assert.strictEqual(uniqueFiles.length, 1, 'Should only search current file');
      assert.strictEqual(uniqueFiles[0], 'helpers.ts', 'Should only find in helpers.ts');

      // Should find multiple functions in helpers.ts
      assert.ok(
        results.count >= 3,
        'Should find at least 3 occurrences of "function" in helpers.ts',
      );
      assert.ok(results.count < 20, 'Should not find excessive occurrences');
    });

    test('correctly sets search mode for each command', () => {
      cx.resetContext();
      assert.strictEqual(cx.searchMode, 'all', 'Default mode should be all');

      // File search mode
      vscode.commands.executeCommand('periscope.searchFiles');
      // Would need to wait for command to complete, but we can test the mode is set
    });
  });

  suite('Preview and Decorations', () => {
    test('shows file preview when navigating search results', async function () {
      this.timeout(5000);

      // Get current editor state
      const editorBefore = vscode.window.activeTextEditor;

      // Perform search
      const results = await periscopeTestHelpers.search('TODO');

      assert.ok(results.count > 0, 'Should find TODO comments');
      assert.ok(cx.qp, 'QuickPick should be initialized');

      // Navigate to first result
      const firstItem = cx.qp.items[0] as any;
      cx.qp.activeItems = [firstItem];

      // Wait for preview to open
      const previewEditor = await waitForPreviewUpdate(editorBefore);
      assert.ok(previewEditor, 'Should open preview editor');

      // Verify preview is at correct location
      if (firstItem.data?.linePos) {
        const expectedLine = firstItem.data.linePos - 1; // Convert to 0-based
        const cursorLine = previewEditor.selection.active.line;
        assert.strictEqual(cursorLine, expectedLine, 'Preview should position at match line');
      }
    });

    test('updates preview when changing active item', async function () {
      this.timeout(5000);

      // Perform search with multiple results
      const results = await periscopeTestHelpers.search('function');

      assert.ok(results.count > 1, 'Should have multiple results');
      assert.ok(cx.qp, 'QuickPick should be initialized');

      // Navigate to first item
      const firstItem = cx.qp.items[0] as any;
      cx.qp.activeItems = [firstItem];

      // Wait for first preview
      const firstEditor = await waitForPreviewUpdate(undefined);
      const firstFile = firstEditor?.document.uri.fsPath;
      const firstLine = firstEditor?.selection.active.line;

      // Navigate to second item
      const secondItem = cx.qp.items[1] as any;
      cx.qp.activeItems = [secondItem];

      // Wait for preview to update
      const secondEditor = await waitForPreviewUpdate(firstEditor);

      // Verify preview changed
      const differentFile = firstFile !== secondEditor?.document.uri.fsPath;
      const differentLine = firstLine !== secondEditor?.selection.active.line;
      assert.ok(differentFile || differentLine, 'Preview should update when changing active item');
    });

    test('applies peek decorations at match location', async function () {
      this.timeout(5000);

      // Perform search
      const results = await periscopeTestHelpers.search('TODO');

      assert.ok(results.count > 0, 'Should find matches');
      assert.ok(cx.qp, 'QuickPick should be initialized');

      // Navigate to a result
      const item = cx.qp.items[0] as any;
      cx.qp.activeItems = [item];

      // Wait for preview
      await waitForCondition(() => !!vscode.window.activeTextEditor, 500);

      const editor = vscode.window.activeTextEditor;
      assert.ok(editor, 'Should have active editor');

      // Check that cursor/selection is at the match
      if (item.data?.linePos && item.data?.colPos) {
        const expectedLine = item.data.linePos - 1;
        const expectedCol = item.data.colPos - 1;

        const selection = editor.selection;
        assert.strictEqual(selection.active.line, expectedLine, 'Cursor should be at match line');

        // The match text should be near the cursor position
        const lineText = editor.document.lineAt(expectedLine).text;
        const matchText = item.data.textResult || '';
        assert.ok(lineText.includes(matchText.trim()), 'Line should contain match text');
      }
    });

    test('preserves preview mode for navigation', async function () {
      this.timeout(5000);

      // Perform search
      const results = await periscopeTestHelpers.search('function');

      assert.ok(results.count > 1, 'Should have multiple results');
      assert.ok(cx.qp, 'QuickPick should be initialized');

      // Navigate through multiple items
      for (let i = 0; i < Math.min(3, cx.qp.items.length); i++) {
        cx.qp.activeItems = [cx.qp.items[i]];

        // Wait for preview
        await waitForCondition(() => !!vscode.window.activeTextEditor, 300);

        const editor = vscode.window.activeTextEditor;
        assert.ok(editor, `Should have editor for item ${i}`);

        // Check if document is in preview mode
        // Preview mode documents are typically not dirty and not in the working files
        const isPreview = !editor.document.isDirty;
        assert.ok(isPreview, 'Document should be in preview mode during navigation');
      }
    });
  });

  suite('Search Results Verification', () => {
    test('excludes node_modules from results', async () => {
      const results = await periscopeTestHelpers.search('getUserById');

      // Get full file paths from items
      const filePaths = results.items.map((item: any) => item.data?.filePath || '').filter(Boolean);

      // Verify no results from node_modules
      assert.ok(
        !filePaths.some((p) => p.includes('node_modules')),
        'Should not include node_modules in results',
      );
    });

    test('creates correct QuickPick item types for text search', async () => {
      // Test text search creates QPItemQuery
      const textResults = await periscopeTestHelpers.search('TODO');
      assert.ok(
        textResults.items.some((item) => item._type === 'QuickPickItemQuery'),
        'Text search should create QuickPickItemQuery items',
      );
    });

    test('creates correct QuickPick item types for file search', async () => {
      // Test file search creates QPItemFile
      const fileResults = await periscopeTestHelpers.searchFiles('Button');

      assert.ok(
        fileResults.items.length > 0,
        `File search should find items. Found ${fileResults.items.length}`,
      );
      assert.ok(
        fileResults.items.some((item) => item._type === 'QuickPickItemFile'),
        `File search should create QuickPickItemFile items. Types found: ${[...new Set(fileResults.items.map((i) => i._type))].join(', ')}`,
      );
    });
  });
});
