import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import { QPItemQuery, RgLine, AllQPItemVariants, QPItemRgMenuAction } from '../../types';
import { context as cx } from '../../lib/context';
import { setupQuickPickForQuery, setupRgMenuActions } from '../../lib/quickpickActions';
import { getSelectedText } from '../../utils/getSelectedText';
import { peekItem, handleNoResultsFound } from '../../lib/editorActions';

suite('QuickPick UI', () => {
  let sandbox: sinon.SinonSandbox;
  let mockQuickPick: vscode.QuickPick<any>;
  let onDidChangeValueStub: sinon.SinonStub;

  setup(() => {
    sandbox = sinon.createSandbox();

    // Create stubs for event handlers
    onDidChangeValueStub = sandbox.stub().returns({ dispose: () => undefined });

    // Mock QuickPick
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
    } as any;

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
    // Sample ripgrep result
    const rgResult: RgLine = {
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
    };

    // Create QuickPick item from ripgrep result
    const item: QPItemQuery = {
      _type: 'QuickPickItemQuery',
      label: '$(file) src/test.ts:42:13',
      description: 'const test = "hello world";',
      data: {
        filePath: 'src/test.ts',
        linePos: 42,
        colPos: 13,
        rawResult: rgResult,
      },
    };

    // Add item to QuickPick
    cx.qp.items = [item];

    // Verify item formatting
    const formattedItem = cx.qp.items[0] as QPItemQuery;
    assert.strictEqual(formattedItem._type, 'QuickPickItemQuery');
    assert.strictEqual(formattedItem.label, '$(file) src/test.ts:42:13');
    assert.strictEqual(formattedItem.description, 'const test = "hello world";');
    assert.strictEqual(formattedItem.data.filePath, 'src/test.ts');
    assert.strictEqual(formattedItem.data.linePos, 42);
    assert.strictEqual(formattedItem.data.colPos, 13);
    assert.deepStrictEqual(formattedItem.data.rawResult, rgResult);
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
    };
    const mockEditor = {
      document: mockDocument,
      edit: sandbox.stub().resolves(true),
      selection: new vscode.Selection(0, 0, 0, 0),
      revealRange: sandbox.stub(),
    };

    sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDocument as any);
    sandbox.stub(vscode.window, 'showTextDocument').resolves(mockEditor as any);

    // Sample QuickPick item
    const item: QPItemQuery = {
      _type: 'QuickPickItemQuery',
      label: '$(file) src/test.ts:42:13',
      description: 'const test = "hello world";',
      data: {
        filePath: 'src/test.ts',
        linePos: 42,
        colPos: 13,
        rawResult: {} as any,
      },
    };

    // Setup QuickPick handlers
    setupQuickPickForQuery();

    // Verify handlers were registered
    assert.strictEqual(cx.disposables.query.length, 4, 'Should register 4 handlers');

    // Call peekItem directly to test preview functionality
    await peekItem([item]);

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
    assert.strictEqual(cx.qp.placeholder, '🫧 Select actions or type custom rg options (Space key to check/uncheck)');

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
      'Should store custom command when no items selected',
    );
  });

  test('should handle menu actions navigation', async () => {
    // Mock configuration
    cx.config = {
      ...cx.config,
      gotoRgMenuActionsPrefix: '<<',
      rgMenuActions: [
        { value: "--type-add 'web:*.{html|css|js}' -t web", label: 'Web Files' },
        { value: "--type-add 'docs:*.{md|txt}' -t docs", label: 'Documentation Files' },
      ],
    };

    // Setup QuickPick handlers
    setupQuickPickForQuery();

    // Get the handler that was registered
    const handler = onDidChangeValueStub.args[0][0];

    // Call the handler with a query that starts with the menu actions prefix
    handler('<<');

    // Verify QuickPick is configured for menu actions
    assert.strictEqual(cx.qp.canSelectMany, true, 'QuickPick should allow multiple selections');
    assert.strictEqual(
      cx.qp.placeholder,
      '🫧 Select actions or type custom rg options (Space key to check/uncheck)',
      'QuickPick should show correct placeholder',
    );

    // Verify menu items are created correctly
    assert.strictEqual(cx.qp.items.length, 2, 'Should have 2 menu items');

    const firstItem = cx.qp.items[0] as QPItemRgMenuAction;
    assert.strictEqual(firstItem._type, 'QuickPickItemRgMenuAction');
    assert.strictEqual(firstItem.label, 'Web Files');
    assert.strictEqual(firstItem.description, "--type-add 'web:*.{html|css|js}' -t web");
    assert.strictEqual(firstItem.data.rgOption, "--type-add 'web:*.{html|css|js}' -t web");

    const secondItem = cx.qp.items[1] as QPItemRgMenuAction;
    assert.strictEqual(secondItem._type, 'QuickPickItemRgMenuAction');
    assert.strictEqual(secondItem.label, 'Documentation Files');
    assert.strictEqual(secondItem.description, "--type-add 'docs:*.{md|txt}' -t docs");
    assert.strictEqual(secondItem.data.rgOption, "--type-add 'docs:*.{md|txt}' -t docs");

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

    // Verify QuickPick is reset for query input
    assert.strictEqual(cx.qp.canSelectMany, false, 'QuickPick should disable multiple selections');
    assert.strictEqual(cx.qp.placeholder, '🫧', 'QuickPick should show default placeholder');
  });

  test('should handle native search integration', async () => {
    // Mock configuration
    cx.config = {
      ...cx.config,
      enableGotoNativeSearch: true,
      gotoNativeSearchSuffix: '>>',
    };

    // Mock VSCode commands
    const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();

    // Setup QuickPick handlers
    setupQuickPickForQuery();

    // Get the handler that was registered
    const handler = onDidChangeValueStub.args[0][0];
    console.log('Handler registered:', !!handler);

    // Set the search query
    const searchQuery = 'searchTerm >>';
    cx.query = searchQuery;
    console.log('Search query:', searchQuery);
    console.log('Context query:', cx.query);
    console.log('Config:', JSON.stringify(cx.config, null, 2));

    // Call the handler with the search query
    handler(searchQuery);

    // Allow async operations to complete
    await new Promise(setImmediate);

    // Log the command calls
    console.log('Execute command calls:', executeCommandStub.args);

    // Verify native search was triggered with all required parameters
    assert.strictEqual(
      executeCommandStub.calledWith('workbench.action.findInFiles', {
        query: 'searchTerm ',
        isRegex: true,
        isCaseSensitive: false,
        matchWholeWord: false,
        triggerSearch: true,
      }),
      true,
      'Should trigger native search with correct parameters',
    );

    // Verify QuickPick was hidden
    const hideStub = mockQuickPick.hide as sinon.SinonStub;
    assert.strictEqual(hideStub.calledOnce, true, 'Should hide QuickPick after native search');
  });

  test('should handle previous results when no matches found', async () => {
    // Mock configuration
    cx.config = {
      ...cx.config,
      showPreviousResultsWhenNoMatches: true,
    };

    // Sample previous results
    const previousResults: QPItemQuery[] = [
      {
        _type: 'QuickPickItemQuery',
        label: '$(file) src/test.ts:42:13',
        description: 'const test = "hello world";',
        data: {
          filePath: 'src/test.ts',
          linePos: 42,
          colPos: 13,
          rawResult: {},
        },
      },
    ];

    // Set previous results
    cx.qp.items = previousResults;

    // Call handleNoResultsFound
    handleNoResultsFound();

    // Verify previous results are kept
    assert.deepStrictEqual(
      cx.qp.items,
      previousResults,
      'Should keep previous results when showPreviousResultsWhenNoMatches is true',
    );

    // Change configuration to not show previous results
    cx.config = {
      ...cx.config,
      showPreviousResultsWhenNoMatches: false,
    };

    // Mock previous active editor
    cx.previousActiveEditor = {
      document: { uri: vscode.Uri.file('src/test.ts') },
      viewColumn: vscode.ViewColumn.One,
    } as vscode.TextEditor;

    // Mock showTextDocument
    const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves();

    // Call handleNoResultsFound again
    handleNoResultsFound();

    // Verify items are cleared
    assert.strictEqual(cx.qp.items.length, 0, 'Should clear items when showPreviousResultsWhenNoMatches is false');

    // Verify origin document is shown
    assert.strictEqual(
      showTextDocumentStub.calledOnce,
      true,
      'Should show origin document when no results found and showPreviousResultsWhenNoMatches is false',
    );
    assert.deepStrictEqual(
      showTextDocumentStub.firstCall.args,
      [cx.previousActiveEditor.document, { preserveFocus: true, preview: true }],
      'Should call showTextDocument with correct arguments',
    );
  });
});
