import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { PERISCOPE } from '../../lib/periscope';
import { context as cx } from '../../lib/context';
import { activate } from '../../extension';
import { QPItemQuery, AllQPItemVariants } from '../../types';

suite('Periscope Core', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('should register commands on activation', async () => {
    // Create a mock extension context
    const mockMemento = {
      get: () => undefined,
      update: () => Promise.resolve(),
      keys: () => [],
    };

    const mockSecretStorage = {
      get: () => Promise.resolve(''),
      store: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      onDidChange: new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event,
    };

    const mockEnvCollection = {
      persistent: true,
      description: undefined,
      replace: () => undefined,
      append: () => undefined,
      prepend: () => undefined,
      get: () => undefined,
      forEach: () => undefined,
      delete: () => undefined,
      clear: () => undefined,
      getScoped: () => mockEnvCollection,
      *[Symbol.iterator]() {
        yield ['', { value: '', type: vscode.EnvironmentVariableMutatorType.Replace }];
      },
    };

    const mockExtension = {
      id: 'test-extension',
      extensionUri: vscode.Uri.file(''),
      extensionPath: '',
      isActive: true,
      packageJSON: {},
      exports: undefined,
      activate: () => Promise.resolve(),
      extensionKind: vscode.ExtensionKind.UI,
    };

    const context = {
      subscriptions: [] as { dispose(): void }[],
      extensionPath: '',
      globalStoragePath: '',
      logPath: '',
      asAbsolutePath: () => '',
      storagePath: '',
      globalState: mockMemento,
      workspaceState: mockMemento,
      secrets: mockSecretStorage,
      extensionUri: vscode.Uri.file(''),
      environmentVariableCollection: mockEnvCollection,
      extensionMode: vscode.ExtensionMode.Test,
      storageUri: vscode.Uri.file(''),
      globalStorageUri: vscode.Uri.file(''),
      logUri: vscode.Uri.file(''),
      extension: mockExtension,
      languageModelAccessInformation: {
        keyId: 'test-key',
        endpoint: 'test-endpoint',
      },
    } as unknown as vscode.ExtensionContext;

    // Stub the vscode.commands.registerCommand
    const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns({
      dispose: () => undefined,
    });

    // Call activate function
    activate(context);

    // Verify command registration
    assert.strictEqual(registerCommandStub.callCount, 2, 'Should register two commands');
    assert.strictEqual(registerCommandStub.firstCall.args[0], 'periscope.search', 'Should register search command');
    assert.strictEqual(
      registerCommandStub.secondCall.args[0],
      'periscope.openInHorizontalSplit',
      'Should register horizontal split command',
    );

    // Verify commands are added to subscriptions
    assert.strictEqual(context.subscriptions.length, 2, 'Should add commands to subscriptions');
  });

  test('should perform search operation', async () => {
    // Mock the config
    sandbox.stub(cx, 'config').value({
      alwaysShowRgMenuActions: false,
      rgMenuActions: [],
    });

    // Create a new QuickPick instance for testing
    const mockQuickPick: Partial<vscode.QuickPick<AllQPItemVariants>> = {
      show: sandbox.stub(),
      onDidHide: sandbox.stub().returns({ dispose: () => undefined }),
      onDidChangeValue: sandbox.stub().returns({ dispose: () => undefined }),
      onDidChangeActive: sandbox.stub().returns({ dispose: () => undefined }),
      onDidAccept: sandbox.stub().returns({ dispose: () => undefined }),
      onDidTriggerItemButton: sandbox.stub().returns({ dispose: () => undefined }),
      dispose: sandbox.stub(),
      items: [],
      value: '',
      placeholder: '',
      busy: false,
      canSelectMany: false,
    };

    // Stub the window.createQuickPick
    sandbox.stub(vscode.window, 'createQuickPick').returns(mockQuickPick as vscode.QuickPick<AllQPItemVariants>);

    // Stub the setContext command
    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

    // Call search function
    PERISCOPE.search();

    // Verify QuickPick is shown
    assert.strictEqual((mockQuickPick.show as sinon.SinonStub).calledOnce, true, 'Should show QuickPick');

    // Verify onDidHide handler is registered
    assert.strictEqual(
      (mockQuickPick.onDidHide as sinon.SinonStub).calledOnce,
      true,
      'Should register onDidHide handler',
    );

    // Verify extension context is set
    assert.strictEqual(
      executeCommandStub.calledWith('setContext', 'periscopeActive', true),
      true,
      'Should set extension context to active',
    );
  });

  test('should handle horizontal split operation', async () => {
    // Stub the window.showTextDocument
    const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves();

    // Stub the workspace.openTextDocument
    const openTextDocumentStub = sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as vscode.TextDocument);

    // Create a new QuickPick instance for testing
    const mockQuickPick: Partial<vscode.QuickPick<AllQPItemVariants>> = {
      activeItems: [] as readonly AllQPItemVariants[],
      dispose: sandbox.stub(),
    };

    // Mock the QuickPick state
    const mockItem: QPItemQuery = {
      _type: 'QuickPickItemQuery',
      label: 'Test File',
      description: 'test/file.ts:1:1',
      data: {
        filePath: 'test/file.ts',
        linePos: 1,
        colPos: 1,
        rawResult: {},
      },
    };
    mockQuickPick.activeItems = [mockItem];

    // Replace the context's QuickPick with our mock
    sandbox.stub(cx, 'qp').value(mockQuickPick as vscode.QuickPick<AllQPItemVariants>);

    // Call horizontal split function
    await PERISCOPE.openInHorizontalSplit();

    // Verify document is opened
    assert.strictEqual(openTextDocumentStub.calledOnce, true, 'Should open text document');

    // Verify document is shown in split view
    assert.strictEqual(showTextDocumentStub.calledOnce, true, 'Should show text document');
    assert.deepStrictEqual(
      showTextDocumentStub.firstCall.args[1],
      { viewColumn: vscode.ViewColumn.Beside },
      'Should show in split view',
    );
  });
});
