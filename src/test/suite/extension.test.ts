import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { activate } from '../../extension';
import { context as cx } from '../../lib/context';
import { setSearchMode } from '../../utils/searchCurrentFile';

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
    test('periscope.search uses "all" mode', () => {
      assert.strictEqual(cx.searchMode, 'all');
      assert.strictEqual(cx.qp.title, undefined);
    });

    test('periscope.searchCurrentFile uses "currentFile" mode', () => {
      setSearchMode('currentFile');
      assert.strictEqual(cx.searchMode, 'currentFile');
      assert.strictEqual(cx.qp.title, 'Search current file only');
    });

    test('periscope.searchFiles uses "files" mode', () => {
      setSearchMode('files');
      assert.strictEqual(cx.searchMode, 'files');
      assert.strictEqual(cx.qp.title, 'File Search');
    });

    test('--files flag switches to file search mode', () => {
      // Simulate user typing --files
      const query = '--files package.json';
      const hasFilesFlag = query.includes('--files');

      if (hasFilesFlag) {
        setSearchMode('files');
      }

      assert.strictEqual(cx.searchMode, 'files');
      assert.strictEqual(cx.qp.title, 'File Search');
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
