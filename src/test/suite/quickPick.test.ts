import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import { PERISCOPE } from '../../lib/periscope';
import { QPItemQuery, QPItemRgMenuAction } from '../../types';
import { RgMatchRawResult } from '../../types/ripgrep';
import { context as cx } from '../../lib/context';
import { setupQuickPickForQuery, setupRgMenuActions } from '../../lib/quickpickActions';
import { getSelectedText } from '../../utils/getSelectedText';
import { peekItem } from '../../lib/editorActions';
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

  function createMockProcess(stdoutEmitter: EventEmitter, processEmitter: EventEmitter) {
    return {
      stdout: {
        on: stdoutEmitter.on.bind(stdoutEmitter),
        destroy: sinon.stub(),
      },
      stderr: {
        on: sinon.stub(),
        destroy: sinon.stub(),
      },
      kill: sinon.stub(),
      on: processEmitter.on.bind(processEmitter),
      connected: false,
      killed: false,
      pid: 123,
      stdin: null,
      stdio: [],
    } as unknown as cp.ChildProcessWithoutNullStreams;
  }

  test('should format search results correctly', async () => {
    // Setup event emitters and process
    const stdoutEmitter = new EventEmitter();
    const processEmitter = new EventEmitter();
    const mockSpawn = sandbox.stub(cp, 'spawn');
    mockSpawn.returns(createMockProcess(stdoutEmitter, processEmitter));

    // Sample ripgrep result
    const rgResult: RgMatchRawResult = {
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

    // Setup context
    cx.config = { rgPath: 'rg' } as any;
    Object.defineProperty(cx, 'appState', {
      value: 'SEARCHING',
      writable: true,
    });

    // Execute search and emit results
    rgSearch('hello');
    stdoutEmitter.emit('data', Buffer.from(JSON.stringify(rgResult) + '\n'));
    await new Promise(setImmediate);
    processEmitter.emit('exit', 0);
    await new Promise(setImmediate);

    // Verify results
    const formattedItem = cx.qp.items[0] as QPItemQuery;
    assert.ok(formattedItem, 'No items found in QuickPick');

    // Verify type and basic properties
    assert.strictEqual(formattedItem._type, 'QuickPickItemQuery');
    assert.strictEqual(formattedItem.alwaysShow, true);
    assert.strictEqual(formattedItem.detail, 'src/test.ts');

    // Verify content
    assert.strictEqual(formattedItem.label, 'const test = "hello world";');
    assert.deepStrictEqual(formattedItem.data.rawResult, {
      filePath: 'src/test.ts',
      linePos: 42,
      colPos: 13,
      textResult: 'const test = "hello world";',
    });

    // Verify location data
    assert.strictEqual(formattedItem.data.filePath, 'src/test.ts');
    assert.strictEqual(formattedItem.data.linePos, 42);
    assert.strictEqual(formattedItem.data.colPos, 13);

    // Verify UI elements
    assert.strictEqual(formattedItem.buttons?.length, 1);
    assert.strictEqual(formattedItem.buttons[0].tooltip, 'Open in Horizontal split');
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
        rawResult: {
          type: 'match',
          data: {
            path: { text: 'src/test.ts' },
            lines: { text: 'const test = "hello world";' },
            line_number: 42,
            absolute_offset: 100,
            submatches: [
              {
                match: { text: 'hello' },
                start: 12,
                end: 17,
              },
            ],
          },
        },
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
      peekMatchColor: 'rgba(255, 255, 0, 0.3)',
      peekMatchBorderColor: 'rgba(255, 255, 0, 0.5)',
      peekMatchBorderWidth: '1px',
      peekMatchBorderStyle: 'solid',
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
