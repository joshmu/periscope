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
    const mockContext = {
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
      extension: {
        id: 'test-extension',
        extensionKind: vscode.ExtensionKind.UI,
      },
    } as unknown as vscode.ExtensionContext;

    // Stub the vscode.commands.registerCommand
    const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns({
      dispose: () => undefined,
    });

    // Call activate function
    activate(mockContext);

    // Verify command registration
    assert.strictEqual(registerCommandStub.callCount, 3, 'Should register three commands');
    assert.strictEqual(
      registerCommandStub.firstCall.args[0],
      'periscope.search',
      'Should register search command',
    );
    assert.strictEqual(
      registerCommandStub.secondCall.args[0],
      'periscope.searchCurrentFile',
      'Should register search current file command',
    );
    assert.strictEqual(
      registerCommandStub.thirdCall.args[0],
      'periscope.openInHorizontalSplit',
      'Should register horizontal split command',
    );

    // Verify commands are added to subscriptions
    assert.strictEqual(mockContext.subscriptions.length, 3, 'Should add commands to subscriptions');
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
    sandbox
      .stub(vscode.window, 'createQuickPick')
      .returns(mockQuickPick as vscode.QuickPick<AllQPItemVariants>);

    // Stub the setContext command
    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

    // Call search function
    PERISCOPE.search();

    // Verify QuickPick is shown
    assert.strictEqual(
      (mockQuickPick.show as sinon.SinonStub).calledOnce,
      true,
      'Should show QuickPick',
    );

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
    const openTextDocumentStub = sandbox
      .stub(vscode.workspace, 'openTextDocument')
      .resolves({} as vscode.TextDocument);

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
        textResult: 'test',
        rawResult: {
          type: 'match',
          data: {
            path: { text: 'test/file.ts' },
            lines: { text: 'test content' },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            line_number: 1,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            absolute_offset: 0,
            submatches: [
              {
                match: { text: 'test' },
                start: 0,
                end: 4,
              },
            ],
          },
        },
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
