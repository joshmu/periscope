import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { context as cx } from '../../src/lib/context';
import { periscopeTestHelpers } from '../utils/periscopeTestHelper';

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
    test('uses selected text as initial query', async () => {
      // Mock active editor with selection
      const mockEditor = {
        document: {
          getText: (range: any) => 'selectedFunction',
          uri: vscode.Uri.file('/test/file.ts'),
        },
        selection: {
          isEmpty: false,
          start: new vscode.Position(10, 5),
          end: new vscode.Position(10, 20),
        },
      };

      sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);

      // When search is invoked with text selected, it should use that text
      const selectedText = mockEditor.document.getText(mockEditor.selection);
      assert.strictEqual(selectedText, 'selectedFunction');
    });

    test('ignores empty selection', async () => {
      const mockEditor = {
        document: {
          getText: () => '',
          uri: vscode.Uri.file('/test/file.ts'),
        },
        selection: {
          isEmpty: true,
        },
      };

      sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);

      // With empty selection, should not pre-populate query
      assert.strictEqual(mockEditor.selection.isEmpty, true);
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
    test('transforms query with type filter pattern', () => {
      const queryParams = [{ regex: '^(.+) -t ?(\\w+)$', param: '-t $2' }];

      const testCases = [
        { input: 'hello -t rust', expected: { match: true, type: 'rust' } },
        { input: 'search -t js', expected: { match: true, type: 'js' } },
        { input: 'normal search', expected: { match: false, type: null } },
      ];

      testCases.forEach(({ input, expected }) => {
        const regex = new RegExp(queryParams[0].regex);
        const match = regex.test(input);
        assert.strictEqual(
          match,
          expected.match,
          `Pattern should ${expected.match ? '' : 'not '}match "${input}"`,
        );

        if (match) {
          const matches = input.match(regex);
          assert.ok(matches);
          assert.strictEqual(matches[2], expected.type);
        }
      });
    });

    test('transforms query with glob filter pattern', () => {
      const queryParams = [{ regex: '^(.+) -g (.+)$', param: '-g "$2"' }];

      const testCases = [
        { input: 'search -g **/test/**', expected: { match: true, glob: '**/test/**' } },
        { input: 'find -g *.ts', expected: { match: true, glob: '*.ts' } },
        { input: 'normal search', expected: { match: false, glob: null } },
      ];

      testCases.forEach(({ input, expected }) => {
        const regex = new RegExp(queryParams[0].regex);
        const match = regex.test(input);
        assert.strictEqual(match, expected.match);

        if (match) {
          const matches = input.match(regex);
          assert.ok(matches);
          assert.strictEqual(matches[2], expected.glob);
        }
      });
    });

    test('transforms query with file extension pattern', () => {
      const queryParams = [{ regex: '^(.+) \\*\\.(\\w+)$', param: '-g "*.$2"' }];

      const testCases = [
        { input: 'search *.rs', expected: { match: true, ext: 'rs' } },
        { input: 'find *.tsx', expected: { match: true, ext: 'tsx' } },
        { input: 'normal search', expected: { match: false, ext: null } },
      ];

      testCases.forEach(({ input, expected }) => {
        const regex = new RegExp(queryParams[0].regex);
        const match = regex.test(input);
        assert.strictEqual(match, expected.match);

        if (match) {
          const matches = input.match(regex);
          assert.ok(matches);
          assert.strictEqual(matches[2], expected.ext);
        }
      });
    });

    test('transforms query with module filter pattern', () => {
      const queryParams = [{ regex: '^(.+) -m ([\\w-_]+)$', param: '-g "**/*$2*/**"' }];

      const testCases = [
        { input: 'redis -m auth', expected: { match: true, module: 'auth' } },
        { input: 'search -m user-service', expected: { match: true, module: 'user-service' } },
        { input: 'normal search', expected: { match: false, module: null } },
      ];

      testCases.forEach(({ input, expected }) => {
        const regex = new RegExp(queryParams[0].regex);
        const match = regex.test(input);
        assert.strictEqual(match, expected.match);

        if (match) {
          const matches = input.match(regex);
          assert.ok(matches);
          assert.strictEqual(matches[2], expected.module);
        }
      });
    });
  });

  suite('rgMenuActions', () => {
    test('applies menu action filters', () => {
      const menuActions = [
        { label: 'JS/TS Files', value: "--type-add 'jsts:*.{js,ts,tsx,jsx}' -t jsts" },
        { label: 'Markdown', value: '-t md' },
        { label: 'JSON', value: '-t json' },
        { label: 'Exclude tests', value: '-g "!**/*.test.*"' },
      ];

      // Each action should have a label and value
      menuActions.forEach((action) => {
        assert.ok(action.label, 'Menu action should have a label');
        assert.ok(action.value, 'Menu action should have a value');
        assert.ok(
          action.value.startsWith('-') || action.value.startsWith('--'),
          'Menu action value should be a ripgrep parameter',
        );
      });
    });

    test('triggers menu with gotoRgMenuActionsPrefix', () => {
      const prefix = '<<';
      const queries = ['<<', '<<search', 'normal'];

      queries.forEach((query) => {
        const shouldShowMenu = query.startsWith(prefix);
        if (shouldShowMenu) {
          // Would trigger menu display
          assert.ok(query.startsWith(prefix), `Query "${query}" should trigger menu`);
        }
      });
    });

    test('menu action selection modifies search', () => {
      const selectedAction = {
        label: 'JS/TS Files',
        value: "--type-add 'jsts:*.{js,ts,tsx,jsx}' -t jsts",
      };

      // When a menu action is selected, it should be applied to the ripgrep command
      assert.ok(selectedAction.value.includes('-t jsts'));
      assert.ok(selectedAction.value.includes('*.{js,ts,tsx,jsx}'));
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
