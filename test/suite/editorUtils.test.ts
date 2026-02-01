import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { getSelectedText } from '../../src/utils/getSelectedText';
import {
  setSearchMode,
  resetSearchMode,
  getCurrentFilePath,
} from '../../src/utils/searchCurrentFile';
import { context as cx } from '../../src/lib/context';
import {
  TEST_TIMEOUTS,
  openDocumentWithContent,
  selectText,
  selectTextRange,
} from '../utils/periscopeTestHelper';

suite('Editor Utilities - Unit Tests', function () {
  this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

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
    sandbox.restore();

    // Close all editors
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
  });

  suite('getSelectedText', () => {
    test('returns empty string when no editor is active', async () => {
      // Close all editors to ensure no active editor
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      const result = getSelectedText();

      assert.strictEqual(result, '');
    });

    test('returns empty string when no text is selected', async () => {
      const editor = await openDocumentWithContent('function hello() { return "world"; }');

      // Ensure no selection (cursor at position 0)
      editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

      const result = getSelectedText();

      assert.strictEqual(result, '');
    });

    test('returns selected text', async () => {
      const editor = await openDocumentWithContent('function hello() { return "world"; }');

      // Select "hello"
      const selected = await selectText(editor, 'hello');
      assert.ok(selected, 'Should find and select text');

      const result = getSelectedText();

      assert.strictEqual(result, 'hello');
    });

    test('returns selected text with spaces', async () => {
      const editor = await openDocumentWithContent('const message = "hello world";');

      // Select "hello world"
      const selected = await selectText(editor, 'hello world');
      assert.ok(selected, 'Should find and select text');

      const result = getSelectedText();

      assert.strictEqual(result, 'hello world');
    });

    test('returns multi-line selection', async () => {
      const content = `line 1
line 2
line 3`;
      const editor = await openDocumentWithContent(content);

      // Select from start of line 1 to end of line 2
      selectTextRange(
        editor,
        new vscode.Position(0, 0),
        new vscode.Position(1, 6), // "line 2" has 6 chars
      );

      const result = getSelectedText();

      assert.ok(result.includes('line 1'), 'Should include line 1');
      assert.ok(result.includes('line 2'), 'Should include line 2');
    });

    test('returns selected special characters', async () => {
      const editor = await openDocumentWithContent('const regex = /[a-z]+/g;');

      // Select the regex pattern
      const selected = await selectText(editor, '/[a-z]+/g');
      assert.ok(selected, 'Should find and select regex');

      const result = getSelectedText();

      assert.strictEqual(result, '/[a-z]+/g');
    });

    test('returns selected unicode text', async () => {
      const editor = await openDocumentWithContent('const message = "你好世界";');

      // Select the unicode string
      const selected = await selectText(editor, '你好世界');
      assert.ok(selected, 'Should find and select unicode');

      const result = getSelectedText();

      assert.strictEqual(result, '你好世界');
    });

    test('handles empty document', async () => {
      const editor = await openDocumentWithContent('');

      const result = getSelectedText();

      assert.strictEqual(result, '');
    });
  });

  suite('setSearchMode', () => {
    test('sets search mode to all', () => {
      setSearchMode('all');

      assert.strictEqual(cx.searchMode, 'all');
    });

    test('sets search mode to currentFile', () => {
      setSearchMode('currentFile');

      assert.strictEqual(cx.searchMode, 'currentFile');
      assert.strictEqual(cx.qp.title, 'Search current file only');
      assert.ok(cx.qp.placeholder?.includes('current file'));
    });

    test('sets search mode to files', () => {
      setSearchMode('files');

      assert.strictEqual(cx.searchMode, 'files');
      assert.strictEqual(cx.qp.title, 'File Search');
      assert.ok(cx.qp.placeholder?.includes('files'));
    });

    test('updates title for all mode with no injected flags', () => {
      cx.injectedRgFlags = [];
      setSearchMode('all');

      assert.strictEqual(cx.qp.title, undefined);
    });

    test('updates title for all mode with injected flags', () => {
      cx.injectedRgFlags = ['-t', 'js'];
      setSearchMode('all');

      assert.ok(cx.qp.title?.includes('-t'));
      assert.ok(cx.qp.title?.includes('js'));
    });

    test('sets placeholder emoji for all modes', () => {
      const modes: Array<'all' | 'currentFile' | 'files'> = ['all', 'currentFile', 'files'];

      modes.forEach((mode) => {
        setSearchMode(mode);
        assert.ok(
          cx.qp.placeholder?.includes('🫧'),
          `Mode ${mode} should have emoji in placeholder`,
        );
      });
    });
  });

  suite('resetSearchMode', () => {
    test('resets to all mode', () => {
      // First set to a different mode
      setSearchMode('currentFile');
      assert.strictEqual(cx.searchMode, 'currentFile');

      // Reset
      resetSearchMode();

      assert.strictEqual(cx.searchMode, 'all');
    });

    test('clears title after reset', () => {
      // Set currentFile mode which has a title
      setSearchMode('currentFile');
      assert.ok(cx.qp.title);

      // Reset
      cx.injectedRgFlags = [];
      resetSearchMode();

      assert.strictEqual(cx.qp.title, undefined);
    });

    test('resets from files mode', () => {
      setSearchMode('files');
      assert.strictEqual(cx.searchMode, 'files');

      resetSearchMode();

      assert.strictEqual(cx.searchMode, 'all');
    });
  });

  suite('getCurrentFilePath', () => {
    test('returns undefined when no previous editor', () => {
      cx.previousActiveEditor = undefined;

      const result = getCurrentFilePath();

      assert.strictEqual(result, undefined);
    });

    test('returns file path from previous active editor', async () => {
      // Open a document to have an active editor
      const doc = await vscode.workspace.openTextDocument({
        content: 'test content',
        language: 'typescript',
      });
      const editor = await vscode.window.showTextDocument(doc);

      // Set previous active editor
      cx.previousActiveEditor = editor;

      const result = getCurrentFilePath();

      // For untitled documents, the fsPath will exist but be an untitled path
      assert.ok(result !== undefined, 'Should return a path');
      assert.ok(typeof result === 'string', 'Path should be a string');
    });

    test('returns correct path for workspace file', async () => {
      const workspaceRoot = vscode.workspace.rootPath;
      if (!workspaceRoot) {
        // Skip test if no workspace is open
        return;
      }

      // Try to open a known file from workspace
      const files = await vscode.workspace.findFiles('**/*.ts', '**/node_modules/**', 1);
      if (files.length === 0) {
        // Skip if no TypeScript files found
        return;
      }

      const doc = await vscode.workspace.openTextDocument(files[0]);
      const editor = await vscode.window.showTextDocument(doc);

      cx.previousActiveEditor = editor;

      const result = getCurrentFilePath();

      assert.ok(result, 'Should return a path');
      assert.ok(result!.endsWith('.ts'), 'Should end with .ts');
    });
  });

  suite('Search Mode UI Integration', () => {
    test('mode changes update UI elements correctly', () => {
      // Test transition between modes
      const modes: Array<{ mode: 'all' | 'currentFile' | 'files'; expectTitle: boolean }> = [
        { mode: 'all', expectTitle: false },
        { mode: 'currentFile', expectTitle: true },
        { mode: 'files', expectTitle: true },
        { mode: 'all', expectTitle: false },
      ];

      cx.injectedRgFlags = [];

      modes.forEach(({ mode, expectTitle }) => {
        setSearchMode(mode);
        assert.strictEqual(cx.searchMode, mode);

        if (expectTitle) {
          assert.ok(cx.qp.title, `Mode ${mode} should have a title`);
        } else {
          assert.strictEqual(cx.qp.title, undefined, `Mode ${mode} should not have a title`);
        }
      });
    });

    test('injected flags persist across mode changes', () => {
      cx.injectedRgFlags = ['--hidden'];

      setSearchMode('all');
      assert.ok(cx.qp.title?.includes('--hidden'));

      // Change to currentFile mode (has its own title)
      setSearchMode('currentFile');
      assert.strictEqual(cx.qp.title, 'Search current file only');

      // Change back to all - injected flags should still show
      setSearchMode('all');
      assert.ok(cx.qp.title?.includes('--hidden'));
    });
  });
});
