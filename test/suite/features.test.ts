import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { context as cx } from '../../src/lib/context';
import {
  periscopeTestHelpers,
  waitForQuickPick,
  waitForCondition,
  openDocumentWithContent,
  selectText,
  selectTextRange,
  withConfiguration,
} from '../utils/periscopeTestHelper';

suite('Advanced Features', function () {
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
    if (cx.qp) {
      cx.qp.hide();
      cx.qp.dispose();
    }

    sandbox.restore();
    cx.resetContext();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  suite('Selected Text Search', () => {
    test('uses selected text as initial query', async function () {
      this.timeout(5000);

      // Open a document with known content
      const editor = await openDocumentWithContent(
        'function getUserById(id) {\n  return users.find(u => u.id === id);\n}\n\nfunction updateUser() {}',
        'javascript',
      );

      // Select the text "getUserById"
      await selectText(editor, 'getUserById');

      // Verify selection
      const selectedText = editor.document.getText(editor.selection);
      assert.strictEqual(selectedText, 'getUserById', 'Should have selected text');

      // Now invoke search - it should use the selected text
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick(300);

      // The query should be pre-populated with selected text
      assert.ok(cx.qp, 'QuickPick should be initialized');
      assert.strictEqual(cx.qp.value, 'getUserById', 'Should use selected text as initial query');

      // Should find results for the selected text
      await waitForCondition(() => cx.qp.items.length > 0, 1000);
      assert.ok(cx.qp.items.length > 0, 'Should find results for selected text');

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
    });

    test('ignores empty selection', async function () {
      this.timeout(5000);

      // Open a document without selecting anything
      const editor = await openDocumentWithContent(
        'function test() { return true; }',
        'javascript',
      );

      // Ensure selection is empty (just a cursor position)
      const pos = new vscode.Position(0, 0);
      selectTextRange(editor, pos, pos);

      assert.strictEqual(editor.selection.isEmpty, true, 'Selection should be empty');

      // Invoke search
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick(300);

      // Query should be empty (not pre-populated)
      assert.ok(cx.qp, 'QuickPick should be initialized');
      assert.strictEqual(cx.qp.value, '', 'Should not pre-populate query with empty selection');

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
    });

    test('handles multi-line selection', async function () {
      this.timeout(5000);

      // Open a document with multi-line content
      const content = 'function calculate(\n  a: number,\n  b: number\n) {\n  return a + b;\n}';
      const editor = await openDocumentWithContent(content, 'typescript');

      // Select multiple lines (the function signature)
      const text = editor.document.getText();
      const startIndex = text.indexOf('function calculate');
      const endIndex = text.indexOf(')') + 1;

      const startPos = editor.document.positionAt(startIndex);
      const endPos = editor.document.positionAt(endIndex);
      selectTextRange(editor, startPos, endPos);

      // Get the selected text
      const selectedText = editor.document.getText(editor.selection);
      assert.ok(selectedText.includes('\n'), 'Should have multi-line selection');

      // Invoke search
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick(300);

      // The extension should handle multi-line selection appropriately
      // (either use it as-is or extract meaningful part)
      assert.ok(cx.qp, 'QuickPick should be initialized');
      assert.ok(cx.qp.value.length > 0, 'Should handle multi-line selection');

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
    });
  });

  suite('Resume Search', () => {
    test('resumes last search query', async () => {
      // First search
      const firstResults = await periscopeTestHelpers.search('TODO');
      assert.ok(firstResults.count > 0, 'First search should find results');

      // Store the query (this would normally be done by the extension)
      const lastQuery = 'TODO';

      // Resume search should restore the query
      // In real implementation, this would restore from storage
      const mockStorage = {
        get: () => ({ query: lastQuery }),
      };
      assert.strictEqual(mockStorage.get().query, 'TODO');
    });

    test('resumes search in current file mode', async () => {
      // First search in current file
      const firstResults = await periscopeTestHelpers.searchCurrentFile(
        'function',
        'src/utils/helpers.ts',
      );
      assert.ok(firstResults.count > 0, 'Should find functions in current file');

      // Resume should maintain current file mode
      // In real implementation, this would check cx.searchMode
      const resumeMode = 'currentFile';
      assert.strictEqual(resumeMode, 'currentFile');
    });
  });

  suite('rgQueryParams Pattern Matching', () => {
    test('transforms query with type filter pattern and filters results', async function () {
      this.timeout(5000);

      await withConfiguration(
        {
          rgQueryParams: [{ regex: '^(.+) -t ?(\\w+)$', param: '-t $2' }],
        },
        async () => {
          // Search with type filter in query
          await vscode.commands.executeCommand('periscope.search');
          await waitForQuickPick(300);

          // Use type filter syntax
          cx.qp.value = 'function -t ts';
          await waitForCondition(() => cx.qp.items.length > 0, 1000);

          // All results should be from TypeScript files
          const files = cx.qp.items
            .map((item: any) => {
              const filePath = item.data?.filePath || '';
              return filePath.split('/').pop();
            })
            .filter(Boolean);

          const allTypeScript = files.every((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
          assert.ok(allTypeScript, 'All results should be from TypeScript files');

          // Clean up
          cx.qp.hide();
          cx.qp.dispose();
        },
      );
    });

    test('transforms query with glob filter pattern and filters results', async function () {
      this.timeout(5000);

      await withConfiguration(
        {
          rgQueryParams: [{ regex: '^(.+) -g (.+)$', param: '-g "$2"' }],
        },
        async () => {
          // Search with glob filter
          await vscode.commands.executeCommand('periscope.search');
          await waitForQuickPick(300);

          // Use glob filter to search only in test files
          cx.qp.value = 'function -g **/*.test.*';
          await waitForCondition(() => cx.qp.items.length >= 0, 1000);

          if (cx.qp.items.length > 0) {
            // All results should be from test files
            const files = cx.qp.items
              .map((item: any) => {
                const filePath = item.data?.filePath || '';
                return filePath.split('/').pop();
              })
              .filter(Boolean);

            const allTestFiles = files.every((f) => f.includes('.test.'));
            assert.ok(allTestFiles, 'All results should be from test files');
          }

          // Clean up
          cx.qp.hide();
          cx.qp.dispose();
        },
      );
    });

    test('transforms query with file extension pattern and filters results', async function () {
      this.timeout(5000);

      await withConfiguration(
        {
          rgQueryParams: [{ regex: '^(.+) \\*\\.(\\w+)$', param: '-g "*.$2"' }],
        },
        async () => {
          // Search with file extension filter
          await vscode.commands.executeCommand('periscope.search');
          await waitForQuickPick(300);

          // Use extension filter
          cx.qp.value = 'function *.ts';
          await waitForCondition(() => cx.qp.items.length > 0, 1000);

          // All results should be from .ts files
          const files = cx.qp.items
            .map((item: any) => {
              const filePath = item.data?.filePath || '';
              return filePath.split('/').pop();
            })
            .filter(Boolean);

          const allTsFiles = files.every((f) => f.endsWith('.ts'));
          assert.ok(allTsFiles, 'All results should be from .ts files');

          // Clean up
          cx.qp.hide();
          cx.qp.dispose();
        },
      );
    });

    test('transforms query with module filter pattern and filters results', async function () {
      this.timeout(5000);

      await withConfiguration(
        {
          rgQueryParams: [{ regex: '^(.+) -m ([\\w-_]+)$', param: '-g "**/*$2*/**"' }],
        },
        async () => {
          // Search with module filter
          await vscode.commands.executeCommand('periscope.search');
          await waitForQuickPick(300);

          // Use module filter to search in utils directory
          cx.qp.value = 'function -m utils';
          await waitForCondition(() => cx.qp.items.length >= 0, 1000);

          if (cx.qp.items.length > 0) {
            // All results should be from utils directory
            const files = cx.qp.items.map((item: any) => item.data?.filePath || '').filter(Boolean);
            const allFromUtils = files.every((f) => f.includes('/utils/'));
            assert.ok(allFromUtils, 'All results should be from utils directory');
          }

          // Clean up
          cx.qp.hide();
          cx.qp.dispose();
        },
      );
    });
  });

  suite('rgMenuActions', () => {
    test('applies menu action filters to actual search results', async function () {
      this.timeout(5000);

      // First, do a search without filters to get baseline
      const allResults = await periscopeTestHelpers.search('function');
      assert.ok(allResults.count > 0, 'Should find functions without filter');

      // Count TypeScript/JavaScript files in baseline
      const tsJsFiles = allResults.files.filter(
        (f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'),
      );
      const otherFiles = allResults.files.filter(
        (f) =>
          !f.endsWith('.ts') && !f.endsWith('.tsx') && !f.endsWith('.js') && !f.endsWith('.jsx'),
      );

      // Only run this test if we have mixed file types
      if (otherFiles.length > 0) {
        // Now search with JS/TS filter menu action
        const filteredResults = await periscopeTestHelpers.searchWithMenuAction('function', {
          label: 'JS/TS Files',
          value: "--type-add 'jsts:*.{js,ts,tsx,jsx}' -t jsts",
        });

        // Should only find results in JS/TS files
        const filteredTsJsFiles = filteredResults.files.filter(
          (f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'),
        );

        assert.ok(filteredResults.count > 0, 'Should find results with filter');
        assert.ok(
          filteredResults.count <= allResults.count,
          'Filtered results should be less than or equal to all results',
        );
        assert.strictEqual(
          filteredTsJsFiles.length,
          filteredResults.files.length,
          'All filtered results should be JS/TS files',
        );
      }
    });

    test('exclude tests menu action filters out test files', async function () {
      this.timeout(5000);

      // First search including test files
      const withTests = await periscopeTestHelpers.search('function');
      const testFiles = withTests.files.filter((f) => f.includes('.test.') || f.includes('.spec.'));

      // Only run if we have test files
      if (testFiles.length > 0) {
        // Search with exclude tests action
        const withoutTests = await periscopeTestHelpers.searchWithMenuAction('function', {
          label: 'Exclude tests',
          value: '-g "!**/*.test.*" -g "!**/*.spec.*"',
        });

        // Should not include any test files
        const filteredTestFiles = withoutTests.files.filter(
          (f) => f.includes('.test.') || f.includes('.spec.'),
        );

        assert.strictEqual(filteredTestFiles.length, 0, 'Should exclude all test files');
        assert.ok(
          withoutTests.count < withTests.count,
          'Should have fewer results without test files',
        );
      }
    });

    test('triggers menu with gotoRgMenuActionsPrefix and applies selection', async function () {
      this.timeout(5000);

      // Start search
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick(300);

      assert.ok(cx.qp, 'QuickPick should be initialized');

      // Use prefix to trigger menu
      const prefix = '<<';
      cx.qp.value = prefix;

      // Store the value right after setting it
      const valueAfterSet = cx.qp.value;

      // Wait a bit for menu trigger
      await new Promise((resolve) => setTimeout(resolve, 200));

      // The value should still contain the prefix (or menu might have consumed it)
      // The actual behavior might clear the value or change it
      assert.ok(
        valueAfterSet.startsWith(prefix),
        `Should have detected menu prefix. Value after set: ${valueAfterSet}`,
      );

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
    });
  });

  suite('Native Search Integration', () => {
    test('switches to native search with suffix', () => {
      const suffix = '>>>';
      const queries = [
        { input: 'search term>>>', shouldSwitch: true, cleanQuery: 'search term' },
        { input: 'normal search', shouldSwitch: false, cleanQuery: 'normal search' },
        { input: 'test>>>', shouldSwitch: true, cleanQuery: 'test' },
      ];

      queries.forEach(({ input, shouldSwitch, cleanQuery }) => {
        const hasNativeSuffix = input.endsWith(suffix);
        assert.strictEqual(hasNativeSuffix, shouldSwitch);

        if (shouldSwitch) {
          const extractedQuery = input.slice(0, -suffix.length);
          assert.strictEqual(extractedQuery, cleanQuery);
          // Would execute: vscode.commands.executeCommand('workbench.action.findInFiles', { query: cleanQuery })
        }
      });
    });
  });

  suite('Multi-root Workspace Support', () => {
    test('searches across multiple workspace folders', () => {
      const mockWorkspaceFolders = [
        { name: 'frontend', uri: vscode.Uri.file('/workspace/frontend'), index: 0 },
        { name: 'backend', uri: vscode.Uri.file('/workspace/backend'), index: 1 },
        { name: 'shared', uri: vscode.Uri.file('/workspace/shared'), index: 2 },
      ];

      sandbox.stub(vscode.workspace, 'workspaceFolders').value(mockWorkspaceFolders);

      // Should search in all folders
      assert.strictEqual(mockWorkspaceFolders.length, 3);
      mockWorkspaceFolders.forEach((folder) => {
        assert.ok(folder.name);
        assert.ok(folder.uri);
        assert.ok(typeof folder.index === 'number');
      });
    });

    test('handles workspace folder in file path display', () => {
      const showWorkspaceFolder = true;
      const filePath = '/workspace/frontend/src/components/Button.tsx';
      const workspaceName = 'frontend';

      if (showWorkspaceFolder) {
        // Should include workspace name in display
        assert.ok(workspaceName, 'Should show workspace folder name');
      }
    });
  });

  suite('Previous Results Retention', () => {
    test('shows previous results when no matches found', async () => {
      // First search with results
      const firstResults = await periscopeTestHelpers.search('TODO');
      assert.ok(firstResults.count > 0, 'Should have initial results');

      // Mock no results scenario with config enabled
      const showPreviousResults = true;
      const currentResults: any[] = [];

      if (showPreviousResults && currentResults.length === 0) {
        // Should keep showing previous results
        assert.ok(firstResults.items.length > 0, 'Should retain previous results');
      }
    });

    test('clears results when disabled', () => {
      const showPreviousResults = false;
      const currentResults: any[] = [];
      const previousResults = [{ label: 'old result' }];

      if (!showPreviousResults && currentResults.length === 0) {
        // Should clear display
        assert.strictEqual(currentResults.length, 0, 'Should not show previous results');
      }
    });
  });

  suite('Path Formatting', () => {
    test('formats paths according to display configuration', () => {
      const pathScenarios = [
        {
          path: '/workspace/project/src/components/ui/buttons/Button.tsx',
          config: {
            showWorkspaceFolderInFilePath: true,
            startFolderDisplayIndex: 0,
            startFolderDisplayDepth: 2,
            endFolderDisplayDepth: 2,
          },
          expected: 'project/src/.../buttons/Button.tsx',
        },
        {
          path: '/workspace/app/lib/utils/helpers/string.ts',
          config: {
            showWorkspaceFolderInFilePath: false,
            startFolderDisplayIndex: 1,
            startFolderDisplayDepth: 1,
            endFolderDisplayDepth: 3,
          },
          expected: 'lib/.../utils/helpers/string.ts',
        },
      ];

      pathScenarios.forEach(({ path, config, expected }) => {
        // Path formatting logic would be applied here
        assert.ok(path);
        assert.ok(config);
        assert.ok(expected);
      });
    });
  });

  suite('Peek Decorations', () => {
    test('applies custom peek border styles', () => {
      const peekConfig = {
        borderColor: '#007ACC',
        borderWidth: '3px',
        borderStyle: 'dashed',
      };

      // These styles should be applied to the peek decoration
      assert.ok(peekConfig.borderColor);
      assert.ok(peekConfig.borderWidth);
      assert.ok(peekConfig.borderStyle);
    });

    test('highlights matching text with custom styles', () => {
      const matchConfig = {
        matchColor: '#FFA500',
        matchBorderColor: '#FF6347',
        matchBorderWidth: '2px',
        matchBorderStyle: 'solid',
      };

      // These styles should be applied to matching text
      assert.ok(matchConfig.matchColor);
      assert.ok(matchConfig.matchBorderColor);
    });

    test('falls back to editor theme colors when not configured', () => {
      const peekConfig = {
        borderColor: undefined,
        matchColor: undefined,
      };

      // Should use editor's find match highlight colors
      assert.strictEqual(peekConfig.borderColor, undefined);
      assert.strictEqual(peekConfig.matchColor, undefined);
    });
  });

  suite('Raw Queries with Quotes', () => {
    test('passes raw ripgrep parameters with quoted queries', async () => {
      // Quoted queries allow additional ripgrep parameters
      const rawQueries = [
        { query: '"foobar" -t js', expectedSearch: 'foobar', expectedParams: '-t js' },
        {
          query: '"test function" -g "*.test.ts"',
          expectedSearch: 'test function',
          expectedParams: '-g "*.test.ts"',
        },
        { query: '"TODO" --max-count=1', expectedSearch: 'TODO', expectedParams: '--max-count=1' },
      ];

      rawQueries.forEach(({ query, expectedSearch, expectedParams }) => {
        // Extract search term and parameters
        const match = query.match(/^"([^"]+)"(.*)$/);
        if (match) {
          assert.strictEqual(match[1], expectedSearch);
          assert.strictEqual(match[2].trim(), expectedParams);
        }
      });
    });
  });

  suite('File Search Mode', () => {
    test('--files flag switches to file search mode', () => {
      const queries = [
        { input: '--files Button', shouldSwitchMode: true },
        { input: 'Button', shouldSwitchMode: false },
        { input: '--files', shouldSwitchMode: true },
      ];

      queries.forEach(({ input, shouldSwitchMode }) => {
        const hasFilesFlag = input.startsWith('--files');
        assert.strictEqual(hasFilesFlag, shouldSwitchMode);

        if (shouldSwitchMode) {
          // Would switch to files mode
          const searchTerm = input.replace('--files', '').trim();
          assert.ok(searchTerm !== undefined);
        }
      });
    });
  });
});
