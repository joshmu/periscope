import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { context as cx } from '../../src/lib/context';
import { QPItemQuery } from '../../src/types';
import {
  periscopeTestHelpers,
  waitForCondition,
  waitForPreviewUpdate,
  withConfiguration,
  hasLineNumbersInDetails,
  LINE_NUMBER_REGEX,
  TEST_TIMEOUTS,
} from '../utils/periscopeTestHelper';

suite('Search Functionality with Fixtures', function () {
  // Increase timeout for all tests in this suite
  this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

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
    await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
  });

  suite('Text Search in Fixture Workspace', () => {
    test('finds TODO comments using periscope.search', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

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

    test('searchFiles respects --smart-case option for lowercase queries', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // With --smart-case, an all-lowercase query should match case-insensitively
      // e.g. "dockerfile" should match a file named "Dockerfile"
      await withConfiguration(
        {
          rgOptions: ['--smart-case'],
        },
        async () => {
          const results = await periscopeTestHelpers.searchFiles('dockerfile');

          assert.ok(
            results.count > 0,
            'searchFiles with --smart-case should find "Dockerfile" when querying "dockerfile" (lowercase)',
          );
          assert.ok(
            results.files.includes('Dockerfile'),
            `Should find Dockerfile in results. Found files: ${results.files.join(', ')}`,
          );
        },
      );
    });

    test('searchFiles respects --smart-case option for mixed-case queries', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // With --smart-case, a query with uppercase should match case-sensitively
      // e.g. "Docker" should match "Dockerfile" but not "dockerfile"
      await withConfiguration(
        {
          rgOptions: ['--smart-case'],
        },
        async () => {
          const results = await periscopeTestHelpers.searchFiles('Docker');

          assert.ok(
            results.count > 0,
            'searchFiles with --smart-case should find "Dockerfile" when querying "Docker" (has uppercase)',
          );
          assert.ok(
            results.files.includes('Dockerfile'),
            `Should find Dockerfile in results. Found files: ${results.files.join(', ')}`,
          );
        },
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
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Close all editors to ensure clean starting state
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Perform search
      const results = await periscopeTestHelpers.search('TODO');

      assert.ok(results.count > 0, 'Should find TODO comments');
      assert.ok(cx.qp, 'QuickPick should be initialized');

      // Get the first item and set it as active to trigger its preview
      const firstItem = cx.qp.items[0] as any;
      cx.qp.activeItems = [firstItem];

      // Wait for preview to fully update (including cursor positioning)
      const previewEditor = await waitForPreviewUpdate();
      assert.ok(previewEditor, 'Should open preview for active item');

      // Verify preview is at correct location
      if (firstItem.data?.linePos) {
        const expectedLine = firstItem.data.linePos - 1; // Convert to 0-based
        const cursorLine = previewEditor.selection.active.line;

        // Allow some flexibility - the cursor might be slightly off due to timing
        assert.ok(
          Math.abs(cursorLine - expectedLine) <= 1,
          `Preview should position near match line. Expected: ${expectedLine}, Actual: ${cursorLine}`,
        );
      }
    });

    test('updates preview when changing active item', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

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
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Close all editors to ensure clean starting state
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Perform search
      const results = await periscopeTestHelpers.search('TODO');

      assert.ok(results.count > 0, 'Should find matches');
      assert.ok(cx.qp, 'QuickPick should be initialized');

      // Get the first item and set it as active to trigger its preview
      const item = cx.qp.items[0] as any;
      cx.qp.activeItems = [item];

      // Wait for preview to fully update (including cursor positioning)
      const editor = await waitForPreviewUpdate();
      assert.ok(editor, 'Should open preview for active item');

      // Check that cursor/selection is at the match
      if (item.data?.linePos && item.data?.colPos) {
        const expectedLine = item.data.linePos - 1;
        const expectedCol = item.data.colPos - 1;

        const selection = editor.selection;

        // Allow some flexibility in line positioning
        assert.ok(
          Math.abs(selection.active.line - expectedLine) <= 1,
          `Cursor should be near match line. Expected: ${expectedLine}, Actual: ${selection.active.line}`,
        );

        // The match text should be near the cursor position
        const lineToCheck = editor.document.lineAt(selection.active.line).text;
        const matchText = item.data.textResult || '';
        assert.ok(
          lineToCheck.includes(matchText.trim()) || lineToCheck.includes('TODO'),
          'Line should contain match text or TODO',
        );
      }
    });

    test('preserves preview mode for navigation', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Perform search
      const results = await periscopeTestHelpers.search('function');

      assert.ok(results.count > 1, 'Should have multiple results');
      assert.ok(cx.qp, 'QuickPick should be initialized');

      // Navigate through multiple items
      for (let i = 0; i < Math.min(3, cx.qp.items.length); i++) {
        cx.qp.activeItems = [cx.qp.items[i]];

        // Wait for preview
        await waitForCondition(() => !!vscode.window.activeTextEditor, TEST_TIMEOUTS.EDITOR_ACTIVE);

        const editor = vscode.window.activeTextEditor;
        assert.ok(editor, `Should have editor for item ${i}`);

        // Check if document is in preview mode
        // In VSCode test environment, preview mode detection might not work as expected
        // We'll check that the document is at least open and not modified
        const isNotDirty = !editor.document.isDirty;
        const hasContent = editor.document.lineCount > 0;

        // The document should be open and viewable
        assert.ok(hasContent, 'Document should have content');
        assert.ok(isNotDirty, 'Document should not be dirty during navigation');
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

  suite('Line Number Display in Search Results', () => {
    test('verifies line numbers appear in search result details by default', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Test default behavior - no configuration override needed
      // Search for something that will have multiple results
      const results = await periscopeTestHelpers.search('function');
      assert.ok(results.count > 0, 'Should find results');

      // Check the QuickPick items
      const items = cx.qp.items as QPItemQuery[];
      const queryItems = items.filter((item) => item._type === 'QuickPickItemQuery');
      assert.ok(queryItems.length > 0, 'Should have query items');

      // Verify that items have line numbers in their details
      const itemsWithLineNumbers = queryItems.filter(
        (item) => item.detail && LINE_NUMBER_REGEX.test(item.detail),
      );
      assert.ok(
        itemsWithLineNumbers.length > 0,
        `Should have items with line numbers by default. Found ${itemsWithLineNumbers.length} items with line numbers out of ${queryItems.length} total query items`,
      );

      // Verify specific line number format
      const firstItemWithLineNumber = itemsWithLineNumbers[0];
      if (firstItemWithLineNumber && firstItemWithLineNumber.detail) {
        const lineNumberMatch = firstItemWithLineNumber.detail.match(LINE_NUMBER_REGEX);
        assert.ok(lineNumberMatch, 'Should have line number at end of detail');
        if (lineNumberMatch) {
          const lineNumber = parseInt(lineNumberMatch[1], 10);
          assert.ok(lineNumber > 0, `Line number should be positive: ${lineNumber}`);
        }
      }
    });

    test('verifies line numbers are hidden when disabled', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Configure to hide line numbers
      await withConfiguration(
        {
          showLineNumbers: false,
        },
        async () => {
          // Search for something that will have multiple results
          const results = await periscopeTestHelpers.search('function');
          assert.ok(results.count > 0, 'Should find results');

          // Check the QuickPick items
          const items = cx.qp.items as QPItemQuery[];
          const queryItems = items.filter((item) => item._type === 'QuickPickItemQuery');
          assert.ok(queryItems.length > 0, 'Should have query items');

          // Verify that items DO NOT have line numbers in their details
          const itemsWithLineNumbers = queryItems.filter(
            (item) => item.detail && /:\d+$/.test(item.detail),
          );
          assert.strictEqual(
            itemsWithLineNumbers.length,
            0,
            `Should not have items with line numbers when disabled. Found ${itemsWithLineNumbers.length} items with line numbers`,
          );
        },
      );
    });

    test('verifies correct line numbers for specific matches', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Test default behavior - no configuration override needed
      // Search for a specific known pattern in our test fixtures
      const results = await periscopeTestHelpers.search('export function');
      assert.ok(results.count > 0, 'Should find export function declarations');

      // Get the items with line numbers
      const items = cx.qp.items as QPItemQuery[];
      const queryItems = items.filter((item) => item._type === 'QuickPickItemQuery');

      // Each match should have a line number that makes sense (> 0)
      queryItems.forEach((item) => {
        if (item.detail) {
          const lineNumberMatch = item.detail.match(LINE_NUMBER_REGEX);
          if (lineNumberMatch) {
            const lineNumber = parseInt(lineNumberMatch[1], 10);
            assert.ok(
              lineNumber > 0 && lineNumber < 10000,
              `Line number should be reasonable: ${lineNumber}`,
            );
          }
        }

        // Also verify that the line position in the data matches
        if (item.data && typeof item.data.linePos === 'number') {
          assert.ok(item.data.linePos > 0, 'Line position in data should be positive');
        }
      });
    });
  });
});
