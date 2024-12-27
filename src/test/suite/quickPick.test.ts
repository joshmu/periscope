import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import { QPItemQuery, RgLine, QPItemRgMenuAction } from '../../types';
import { context as cx } from '../../lib/context';
import { setupQuickPickForQuery, setupRgMenuActions } from '../../lib/quickpickActions';
import { getSelectedText } from '../../utils/getSelectedText';
import { peekItem } from '../../lib/editorActions';
import { formatPathLabel } from '../../utils/formatPathLabel';
import { createResultItem } from '../../utils/quickpickUtils';
import { rgSearch } from '../../lib/ripgrep';
import * as cp from 'child_process';
import { EventEmitter } from 'events';

suite('QuickPick UI', () => {
  let sandbox: sinon.SinonSandbox;
  let mockQuickPick: vscode.QuickPick<QPItemQuery | QPItemRgMenuAction>;
  let onDidChangeValueStub: sinon.SinonStub;

  setup(() => {
    sandbox = sinon.createSandbox();

    // Create stubs for event handlers
    onDidChangeValueStub = sandbox.stub().returns({ dispose: () => undefined });

    // Mock QuickPick with all required properties
    mockQuickPick = {
      items: [],
      value: '',
      placeholder: '',
      busy: false,
      canSelectMany: false,
      buttons: [],
      show: sandbox.stub(),
      hide: sandbox.stub(),
      dispose: sandbox.stub(),
      onDidChangeValue: onDidChangeValueStub,
      onDidChangeActive: sandbox.stub().returns({ dispose: () => undefined }),
      onDidAccept: sandbox.stub().returns({ dispose: () => undefined }),
      onDidTriggerButton: sandbox.stub().returns({ dispose: () => undefined }),
      onDidTriggerItemButton: sandbox.stub().returns({ dispose: () => undefined }),
      matchOnDescription: false,
      matchOnDetail: false,
      activeItems: [],
      selectedItems: [],
      onDidChangeSelection: sandbox.stub().returns({ dispose: () => undefined }),
      onDidHide: sandbox.stub().returns({ dispose: () => undefined }),
      title: '',
      step: undefined,
      totalSteps: undefined,
      enabled: true,
      ignoreFocusOut: false,
    } as vscode.QuickPick<QPItemQuery | QPItemRgMenuAction>;

    // Mock context
    cx.qp = mockQuickPick;
    cx.disposables = {
      general: [],
      rgMenuActions: [],
      query: [],
    };
  });

  teardown(() => {
    sandbox.restore();
  });

  test('should format search results correctly', async () => {
    // Create event emitters for stdout and process
    const stdoutEmitter = new EventEmitter();
    const processEmitter = new EventEmitter();

    // Mock spawn at the module level
    const mockSpawn = sandbox.stub(cp, 'spawn');
    const mockProcess = {
      stdout: {
        on: stdoutEmitter.on.bind(stdoutEmitter),
        destroy: sandbox.stub(),
      },
      stderr: {
        on: sandbox.stub(),
        destroy: sandbox.stub(),
      },
      kill: sandbox.stub(),
      on: processEmitter.on.bind(processEmitter),
      connected: false,
      killed: false,
      pid: 123,
      stdin: null as any,
      stdio: [] as any[],
    } as unknown as cp.ChildProcessWithoutNullStreams;
    mockSpawn.returns(mockProcess);

    // Sample ripgrep result
    const rgResult: RgLine = {
      type: 'match',
      data: {
        path: { text: 'src/test.ts' },
        lines: { text: 'const test = "hello world";' },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        line_number: 42,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        absolute_offset: 100,
        submatches: [
          {
            match: { text: 'hello' },
            start: 12,
            end: 17,
          },
        ],
      },
    };

    // Mock config and context
    cx.config = {
      rgPath: 'rg',
      rgOptions: [],
      rgGlobExcludes: [],
      addSrcPaths: [],
    } as any;

    // Set initial app state
    Object.defineProperty(cx, 'appState', {
      value: 'SEARCHING',
      writable: true,
    });

    // Perform search
    rgSearch('hello');

    // Emit the sample result and wait for processing
    console.log('Emitting stdout data...');
    stdoutEmitter.emit('data', Buffer.from(JSON.stringify(rgResult) + '\n'));

    // Wait for the stdout data to be processed
    await new Promise(setImmediate);
    console.log('After stdout data processing, items:', cx.qp.items);

    // Emit exit code and wait for processing
    console.log('Emitting exit code...');
    processEmitter.emit('exit', 0);

    // Allow async operations to complete
    await new Promise(setImmediate);
    console.log('After exit processing, items:', cx.qp.items);

    // Verify item formatting
    const formattedItem = cx.qp.items[0] as QPItemQuery;
    assert.ok(formattedItem, 'No items found in QuickPick');
    assert.strictEqual(formattedItem._type, 'QuickPickItemQuery');
    assert.strictEqual(formattedItem.label, 'const test = "hello world";');
    assert.strictEqual(formattedItem.data.filePath, 'src/test.ts');
    assert.strictEqual(formattedItem.data.linePos, 42);
    assert.strictEqual(formattedItem.data.colPos, 13);
    assert.deepStrictEqual(formattedItem.data.rawResult, {
      filePath: 'src/test.ts',
      linePos: 42,
      colPos: 13,
      textResult: 'const test = "hello world";',
    });
    assert.strictEqual(formattedItem.alwaysShow, true);
    assert.strictEqual(formattedItem.buttons?.length, 1);
    assert.strictEqual(formattedItem.buttons[0].tooltip, 'Open in Horizontal split');
    assert.strictEqual(formattedItem.detail, 'src/test.ts');
  });

  test('should handle preview functionality', async () => {
    // Mock path.resolve to return the input path
    sandbox.stub(path, 'resolve').callsFake((p) => p);

    // Mock getSelectedText
    sandbox.stub({ getSelectedText }, 'getSelectedText').returns('');

    // Mock workspace and window
    const mockDocument = {
      lineAt: sandbox.stub().returns({
        range: new vscode.Range(0, 0, 0, 10),
      }),
      uri: vscode.Uri.file('src/test.ts'),
      fileName: 'src/test.ts',
      isUntitled: false,
      languageId: 'typescript',
      version: 1,
      isDirty: false,
      isClosed: false,
      save: sandbox.stub().resolves(true),
      eol: vscode.EndOfLine.LF,
      lineCount: 1,
      getText: sandbox.stub().returns(''),
      getWordRangeAtPosition: sandbox.stub().returns(null),
      offsetAt: sandbox.stub().returns(0),
      positionAt: sandbox.stub().returns(new vscode.Position(0, 0)),
      validateRange: sandbox.stub().returns(new vscode.Range(0, 0, 0, 0)),
      validatePosition: sandbox.stub().returns(new vscode.Position(0, 0)),
    } as unknown as vscode.TextDocument;

    const mockEditor = {
      document: mockDocument,
      edit: sandbox.stub().resolves(true),
      selection: new vscode.Selection(0, 0, 0, 0),
      selections: [new vscode.Selection(0, 0, 0, 0)],
      visibleRanges: [new vscode.Range(0, 0, 0, 0)],
      options: {
        get: sandbox.stub().returns(undefined),
        set: sandbox.stub(),
      },
      revealRange: sandbox.stub(),
      viewColumn: vscode.ViewColumn.One,
      show: sandbox.stub(),
      hide: sandbox.stub(),
    } as unknown as vscode.TextEditor;

    sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDocument);
    sandbox.stub(vscode.window, 'showTextDocument').resolves(mockEditor);

    // Sample QuickPick item
    const item: QPItemQuery = {
      _type: 'QuickPickItemQuery',
      label: '$(file) src/test.ts:42:13',
      description: 'const test = "hello world";',
      data: {
        filePath: 'src/test.ts',
        linePos: 42,
        colPos: 13,
        rawResult: {} as RgLine,
      },
    };

    // Setup QuickPick handlers
    setupQuickPickForQuery();

    // Verify handlers were registered
    assert.strictEqual(cx.disposables.query.length, 4, 'Should register 4 handlers');

    // Call peekItem directly to test preview functionality
    peekItem([item]);

    // Allow async operations to complete
    await new Promise(setImmediate);

    // Get the stubs
    const openTextDocumentStub = vscode.workspace.openTextDocument as sinon.SinonStub;
    const showTextDocumentStub = vscode.window.showTextDocument as sinon.SinonStub;

    // Verify document was opened in preview mode
    assert.strictEqual(openTextDocumentStub.calledOnce, true);
    assert.strictEqual(openTextDocumentStub.firstCall.args[0], 'src/test.ts');

    // Verify document was shown with preview options
    assert.strictEqual(showTextDocumentStub.calledOnce, true);
    assert.deepStrictEqual(showTextDocumentStub.firstCall.args[1], {
      preview: true,
      preserveFocus: true,
    });

    // Verify cursor position was set
    const editStub = mockEditor.edit as sinon.SinonStub;
    const revealRangeStub = mockEditor.revealRange as sinon.SinonStub;
    assert.strictEqual(editStub.calledOnce, true);
    assert.strictEqual(revealRangeStub.calledOnce, true);
  });

  test('should handle menu actions', async () => {
    // Mock configuration with all required properties
    const mockConfig = {
      rgOptions: [] as string[],
      addSrcPaths: [] as string[],
      rgGlobExcludes: [] as string[],
      rgMenuActions: [
        { value: "--type-add 'web:*.{html|css|js}' -t web", label: 'Web Files' },
        { value: "--type-add 'docs:*.{md|txt}' -t docs", label: 'Documentation Files' },
      ],
      rgQueryParams: [] as Array<{ param?: string; regex: string }>,
      rgPath: '',
      showWorkspaceFolderInFilePath: false,
      startFolderDisplayIndex: 0,
      startFolderDisplayDepth: 1,
      gotoRgMenuActionsPrefix: '<<',
      enableGotoNativeSearch: true,
      gotoNativeSearchSuffix: '>>',
      rgQueryParamsShowTitle: true,
      peekBorderStyle: 'none',
      peekBorderColor: '#000000',
      peekBorderWidth: '1px',
      peekBorderRadius: '3px',
      peekMaxHeight: 20,
      peekMinHeight: 3,
      peekLineNumbers: true,
      peekWrapText: true,
      showLineNumbers: true,
      showColumnNumbers: true,
      showFullPath: true,
      endFolderDisplayDepth: 2,
      alwaysShowRgMenuActions: false,
      showPreviousResultsWhenNoMatches: true,
    };
    cx.config = mockConfig;

    // Setup ripgrep menu actions
    setupRgMenuActions();

    // Verify QuickPick is configured correctly for menu actions
    assert.strictEqual(cx.qp.canSelectMany, true, 'QuickPick should allow multiple selections');
    assert.strictEqual(
      cx.qp.placeholder,
      '🫧 Select actions or type custom rg options (Space key to check/uncheck)',
    );

    // Verify menu items are created correctly
    assert.strictEqual(cx.qp.items.length, 2, 'Should have 2 menu items');
    const firstItem = cx.qp.items[0] as QPItemRgMenuAction;
    assert.strictEqual(firstItem._type, 'QuickPickItemRgMenuAction');
    assert.strictEqual(firstItem.label, 'Web Files');
    assert.strictEqual(firstItem.description, "--type-add 'web:*.{html|css|js}' -t web");
    assert.strictEqual(firstItem.data.rgOption, "--type-add 'web:*.{html|css|js}' -t web");

    // Test selection handling
    cx.qp.selectedItems = [cx.qp.items[0]];

    // Setup event emitter for accept action
    const onDidAcceptEmitter = new vscode.EventEmitter<void>();
    Object.defineProperty(mockQuickPick, 'onDidAccept', {
      get: () => onDidAcceptEmitter.event,
    });

    // Register the handler
    setupRgMenuActions();

    // Trigger accept
    onDidAcceptEmitter.fire();

    // Verify selected actions are stored
    assert.deepStrictEqual(
      cx.rgMenuActionsSelected,
      ["--type-add 'web:*.{html|css|js}' -t web"],
      'Should store selected menu action',
    );

    // Test custom command handling
    cx.qp.selectedItems = [];
    cx.qp.value = '--custom-flag';
    onDidAcceptEmitter.fire();

    // Verify custom command is stored
    assert.deepStrictEqual(
      cx.rgMenuActionsSelected,
      ['--custom-flag'],
      'Should store custom command',
    );
  });
});
