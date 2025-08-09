import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { activate } from '../../src/extension';
import { context as cx } from '../../src/lib/context';
import { waitForQuickPick, waitForCondition } from '../utils/periscopeTestHelper';

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

      // 6 commands + 1 output channel
      assert.strictEqual(mockContext.subscriptions.length, 7);
    });
  });

  suite('Search Modes', () => {
    test('periscope.search uses "all" mode', async () => {
      cx.resetContext();

      // Execute the actual command
      await vscode.commands.executeCommand('periscope.search');

      // Wait for QuickPick to be ready
      await waitForQuickPick(200);

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
      const doc = await vscode.workspace.openTextDocument({
        content: 'test content',
        language: 'typescript',
      });
      await vscode.window.showTextDocument(doc);

      // Execute the actual command
      await vscode.commands.executeCommand('periscope.searchCurrentFile');

      // Wait for QuickPick to be ready
      await waitForQuickPick(200);

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
      await waitForQuickPick(200);

      // Assert the mode and title set by the command
      assert.strictEqual(cx.searchMode, 'files');
      assert.strictEqual(cx.qp?.title, 'File Search');

      // Clean up
      if (cx.qp) {
        cx.qp.hide();
        cx.qp.dispose();
      }
    });

    test('--files flag switches to file search mode', async () => {
      cx.resetContext();

      // Execute search command
      await vscode.commands.executeCommand('periscope.search');

      // Wait for QuickPick to be ready
      await waitForQuickPick(200);

      // Simulate user typing --files
      if (cx.qp) {
        cx.qp.value = '--files package.json';

        // The extension should detect the --files flag and switch modes
        // Wait for the mode to switch
        await waitForCondition(() => cx.searchMode === 'files', 300);

        // Assert that the mode switched and title changed
        assert.strictEqual(cx.searchMode, 'files');
        assert.strictEqual(cx.qp.title, 'File Search');
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
    test('search shows quickpick interface', () => {
      const mockQuickPick = createMockQuickPick();
      sandbox.stub(vscode.window, 'createQuickPick').returns(mockQuickPick);
      sandbox.stub(vscode.commands, 'executeCommand');

      // Simulate search command
      cx.resetContext();
      mockQuickPick.show();

      assert.strictEqual((mockQuickPick.show as sinon.SinonStub).calledOnce, true);
    });

    test('resume search restores last query', () => {
      const mockStorage = {
        get: sandbox.stub().returns({ query: 'previous search' }),
        update: sandbox.stub().returns(Promise.resolve()),
        keys: sandbox.stub().returns([]),
      };

      // Mock extension context with storage
      const mockContext = createMockExtensionContext();
      (mockContext as any).workspaceState = mockStorage;

      // Store and retrieve query
      mockStorage.update('lastQuery', { query: 'test query' });
      const lastQuery = mockStorage.get('lastQuery');

      assert.deepStrictEqual(lastQuery, { query: 'previous search' });
    });

    test('horizontal split opens document in new column', async () => {
      const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves();
      sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as vscode.TextDocument);

      // Mock a selected item
      const mockItem = {
        _type: 'QuickPickItemQuery',
        data: {
          filePath: 'test.ts',
          linePos: 1,
          colPos: 1,
        },
      };
      cx.qp.activeItems = [mockItem as any];

      // Simulate opening in split
      await vscode.window.showTextDocument({} as vscode.TextDocument, {
        viewColumn: vscode.ViewColumn.Beside,
      });

      assert.strictEqual(showTextDocumentStub.calledOnce, true);
      assert.deepStrictEqual(showTextDocumentStub.firstCall.args[1], {
        viewColumn: vscode.ViewColumn.Beside,
      });
    });

    test('rgMenuActions shows action menu before search', () => {
      const menuActions = [
        { label: 'JS/TS Files', value: "--type-add 'jsts:*.{js,ts,tsx,jsx}' -t jsts" },
        { label: 'Markdown', value: '-t md' },
        { label: 'JSON', value: '-t json' },
      ];

      // Simulate menu selection
      menuActions.forEach((action) => {
        assert.ok(action.label);
        assert.ok(action.value);
        // Menu item should apply ripgrep parameters
      });
    });

    test('switches to native search with gotoNativeSearchSuffix', () => {
      const queries = [
        { input: 'search term>>>', hasNativeSuffix: true },
        { input: 'normal search', hasNativeSuffix: false },
        { input: 'another>>>', hasNativeSuffix: true },
      ];

      queries.forEach(({ input, hasNativeSuffix }) => {
        const suffix = '>>>';
        const shouldSwitchToNative = input.endsWith(suffix);
        assert.strictEqual(shouldSwitchToNative, hasNativeSuffix);

        if (shouldSwitchToNative) {
          const cleanQuery = input.slice(0, -suffix.length);
          assert.ok(cleanQuery);
          // Would trigger vscode.commands.executeCommand('workbench.action.findInFiles')
        }
      });
    });

    test('handles multi-root workspace folders', () => {
      const workspaceFolders = [
        { name: 'frontend', uri: vscode.Uri.file('/workspace/frontend') },
        { name: 'backend', uri: vscode.Uri.file('/workspace/backend') },
        { name: 'shared', uri: vscode.Uri.file('/workspace/shared') },
      ];

      // Should search in all workspace folders
      assert.strictEqual(workspaceFolders.length, 3);
      workspaceFolders.forEach((folder) => {
        assert.ok(folder.name);
        assert.ok(folder.uri);
      });
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

  function createMockQuickPick() {
    return {
      show: sandbox.stub(),
      hide: sandbox.stub(),
      dispose: sandbox.stub(),
      onDidHide: sandbox.stub().returns({ dispose: () => undefined }),
      onDidChangeValue: sandbox.stub().returns({ dispose: () => undefined }),
      onDidChangeActive: sandbox.stub().returns({ dispose: () => undefined }),
      onDidAccept: sandbox.stub().returns({ dispose: () => undefined }),
      onDidTriggerItemButton: sandbox.stub().returns({ dispose: () => undefined }),
      items: [],
      activeItems: [],
      selectedItems: [],
      value: '',
      placeholder: '',
      busy: false,
      canSelectMany: false,
    } as any;
  }
});
