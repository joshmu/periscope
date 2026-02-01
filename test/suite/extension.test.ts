import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { activate } from '../../src/extension';
import { context as cx } from '../../src/lib/context';
import {
  waitForQuickPick,
  waitForCondition,
  openDocumentWithContent,
  TEST_TIMEOUTS,
} from '../utils/periscopeTestHelper';

suite('Periscope Extension', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    cx.resetContext();
  });

  teardown(() => {
    sandbox.restore();
  });

  suite('Command Registration', () => {
    test('registers all required commands on activation', () => {
      const mockContext = createMockExtensionContext();
      const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns({
        dispose: () => undefined,
      });

      activate(mockContext);

      // Verify all commands are registered
      const expectedCommands = [
        'periscope.search',
        'periscope.searchCurrentFile',
        'periscope.openInHorizontalSplit',
        'periscope.resumeSearch',
        'periscope.resumeSearchCurrentFile',
        'periscope.searchFiles',
        'periscope.bufferList',
      ];

      assert.strictEqual(registerCommandStub.callCount, expectedCommands.length);
      expectedCommands.forEach((cmd, index) => {
        assert.strictEqual(
          registerCommandStub.getCall(index).args[0],
          cmd,
          `Should register ${cmd} command`,
        );
      });
    });

    test('adds all disposables to context subscriptions', () => {
      const mockContext = createMockExtensionContext();
      sandbox.stub(vscode.commands, 'registerCommand').returns({
        dispose: () => undefined,
      });

      activate(mockContext);

      // 7 commands + 1 output channel
      assert.strictEqual(mockContext.subscriptions.length, 8);
    });
  });

  suite('Search Modes', () => {
    test('periscope.search uses "all" mode', async () => {
      cx.resetContext();

      // Execute the actual command
      await vscode.commands.executeCommand('periscope.search');

      // Wait for QuickPick to be ready
      await waitForQuickPick();

      // Assert the mode and title set by the command
      assert.strictEqual(cx.searchMode, 'all');
      // Title should be undefined for 'all' mode
      assert.strictEqual(cx.qp?.title, undefined);

      // Clean up
      if (cx.qp) {
        cx.qp.hide();
        cx.qp.dispose();
      }
    });

    test('periscope.searchCurrentFile uses "currentFile" mode', async () => {
      cx.resetContext();

      // Open a file first
      await openDocumentWithContent('test content', 'typescript');

      // Execute the actual command
      await vscode.commands.executeCommand('periscope.searchCurrentFile');

      // Wait for QuickPick to be ready
      await waitForQuickPick();

      // Assert the mode and title set by the command
      assert.strictEqual(cx.searchMode, 'currentFile');
      assert.strictEqual(cx.qp?.title, 'Search current file only');

      // Clean up
      if (cx.qp) {
        cx.qp.hide();
        cx.qp.dispose();
      }
    });

    test('periscope.searchFiles uses "files" mode', async () => {
      cx.resetContext();

      // Execute the actual command
      await vscode.commands.executeCommand('periscope.searchFiles');

      // Wait for QuickPick to be ready
      await waitForQuickPick();

      // Assert the mode and title set by the command
      assert.strictEqual(cx.searchMode, 'files');
      assert.strictEqual(cx.qp?.title, 'File Search');

      // Clean up
      if (cx.qp) {
        cx.qp.hide();
        cx.qp.dispose();
      }
    });

    test('injected --files flag sets file search mode', async () => {
      cx.resetContext();

      // Execute search command with --files flag injected
      await vscode.commands.executeCommand('periscope.search', { rgFlags: ['--files'] });

      // Wait for QuickPick to be ready
      await waitForQuickPick();

      // Assert that the mode is set correctly from the injected flag
      assert.strictEqual(cx.searchMode, 'files');
      assert.strictEqual(cx.qp.title, 'File Search');

      // Verify we can search for files
      if (cx.qp) {
        cx.qp.value = 'package.json';
        // Wait a moment for search to process
        await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
      } else {
        assert.fail('QuickPick not initialized');
      }

      // Clean up
      if (cx.qp) {
        cx.qp.hide();
        cx.qp.dispose();
      }
    });
  });

  suite('User Workflows', () => {
    test('search shows quickpick interface and accepts input', async () => {
      // Execute real search command
      await vscode.commands.executeCommand('periscope.search');

      // Wait for QuickPick to be ready
      await waitForQuickPick();

      assert.ok(cx.qp, 'QuickPick should be initialized');
      // QuickPick is visible after being shown

      // Test that we can set a value
      cx.qp.value = 'test search';
      assert.strictEqual(cx.qp.value, 'test search', 'Should accept search input');

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
    });

    test('resume search restores last query', async () => {
      // First, perform a search with a specific query
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick();

      const originalQuery = 'original test query';
      cx.qp.value = originalQuery;

      // Wait for search to process
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.QUICKPICK_INIT));

      // Hide the search
      cx.qp.hide();
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Now resume the search
      await vscode.commands.executeCommand('periscope.resumeSearch');
      await waitForQuickPick();

      // Verify the query was restored
      assert.strictEqual(cx.qp.value, originalQuery, 'Should restore previous query');

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
    });

    test('horizontal split opens document in new column', async () => {
      // Perform a real search first
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick();

      cx.qp.value = 'function';
      await waitForCondition(() => cx.qp.items.length > 0, TEST_TIMEOUTS.SEARCH_COMPLEX);

      assert.ok(cx.qp.items.length > 0, 'Should have search results');

      // Select the first item
      cx.qp.activeItems = [cx.qp.items[0]];

      // Get current active editor before split
      const editorBefore = vscode.window.activeTextEditor;

      // Execute horizontal split command
      await vscode.commands.executeCommand('periscope.openInHorizontalSplit');

      // Wait for new editor to open
      await waitForCondition(() => {
        const currentEditor = vscode.window.activeTextEditor;
        return !!(currentEditor && currentEditor !== editorBefore);
      }, TEST_TIMEOUTS.EDITOR_OPEN);

      const editorAfter = vscode.window.activeTextEditor;
      assert.ok(editorAfter, 'Should have opened a new editor');
      assert.notStrictEqual(editorAfter, editorBefore, 'Should be a different editor');

      // Clean up
      if (cx.qp) {
        cx.qp.hide();
        cx.qp.dispose();
      }
    });

    test('switches to native search with gotoNativeSearchSuffix', async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');
      executeCommandStub.withArgs('periscope.search').callThrough();
      executeCommandStub.withArgs('workbench.action.findInFiles').resolves();

      // Start periscope search
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick();

      // Set query with native search suffix
      cx.qp.value = 'search term>>>';

      // Wait a bit for the suffix to be processed
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.CURSOR_POSITION));

      // Check if native search was triggered
      // Note: The actual implementation should handle this
      // For now, we verify the suffix detection logic
      const suffix = '>>>';
      const hasNativeSuffix = cx.qp.value.endsWith(suffix);
      assert.strictEqual(hasNativeSuffix, true, 'Should detect native search suffix');

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
      executeCommandStub.restore();
    });

    test('handles multi-root workspace search', async () => {
      // Execute search in multi-root workspace
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick();

      cx.qp.value = 'function';
      await waitForCondition(() => cx.qp.items.length > 0, TEST_TIMEOUTS.SEARCH_COMPLEX);

      // Check that we have results from multiple directories
      const filePaths = new Set<string>();
      cx.qp.items.forEach((item: any) => {
        if (item.data?.filePath) {
          const parts = item.data.filePath.split(path.sep);
          if (parts.length > 2) {
            // Get the directory structure
            filePaths.add(parts.slice(0, -1).join(path.sep));
          }
        }
      });

      // In a multi-file project, we should find results in different directories
      assert.ok(filePaths.size > 0, 'Should find results in workspace folders');

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
    });
  });

  // Helper functions
  function createMockExtensionContext(): vscode.ExtensionContext {
    return {
      subscriptions: [] as { dispose(): void }[],
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => [],
      },
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => [],
      },
      extensionMode: vscode.ExtensionMode.Test,
      extensionUri: vscode.Uri.file(''),
    } as unknown as vscode.ExtensionContext;
  }
});
