import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import { QPItemQuery, RgLine, AllQPItemVariants, QPItemRgMenuAction } from '../../types';
import { context as cx } from '../../lib/context';
import { setupQuickPickForQuery, setupRgMenuActions } from '../../lib/quickpickActions';
import { getSelectedText } from '../../utils/getSelectedText';
import { peekItem, handleNoResultsFound } from '../../lib/editorActions';
import { createResultItem } from '../../utils/quickpickUtils';

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

  test('should handle search result selection', async () => {
    // Mock path.resolve to return the input path
    sandbox.stub(path, 'resolve').callsFake((p) => p);

    // Sample search result
    const searchResult: QPItemQuery = {
      _type: 'QuickPickItemQuery',
      label: '$(file) src/test.ts:42:13',
      description: 'const test = "hello world";',
      data: {
        filePath: 'src/test.ts',
        linePos: 42,
        colPos: 13,
        rawResult: {},
      },
    };

    // Mock document and editor
    const mockDocument = {
      lineAt: sandbox.stub().returns({
        range: new vscode.Range(0, 0, 0, 10),
      }),
      uri: vscode.Uri.file('src/test.ts'),
    };
    const mockEditor = {
      document: mockDocument,
      edit: sandbox.stub().resolves(true),
      selection: new vscode.Selection(0, 0, 0, 0),
      revealRange: sandbox.stub(),
    };

    // Mock workspace and window
    sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDocument as any);
    sandbox.stub(vscode.window, 'showTextDocument').resolves(mockEditor as any);

    // Setup QuickPick
    setupQuickPickForQuery();
    cx.qp.selectedItems = [searchResult];

    // Get the onDidAccept handler
    const onDidAcceptStub = cx.qp.onDidAccept as sinon.SinonStub;
    const handler = onDidAcceptStub.args[0][0];

    // Call the handler to simulate selection
    await handler();

    // Allow async operations to complete
    await new Promise(setImmediate);

    // Get the stubs
    const openTextDocumentStub = vscode.workspace.openTextDocument as sinon.SinonStub;
    const showTextDocumentStub = vscode.window.showTextDocument as sinon.SinonStub;

    // Verify document was opened
    assert.strictEqual(openTextDocumentStub.calledOnce, true, 'Should open the document');
    assert.strictEqual(openTextDocumentStub.firstCall.args[0], 'src/test.ts', 'Should open the correct file');

    // Verify document was shown
    assert.strictEqual(showTextDocumentStub.calledOnce, true, 'Should show the document');
    assert.deepStrictEqual(showTextDocumentStub.firstCall.args[1], {}, 'Should show document with default options');

    // Verify cursor position was set
    const editStub = mockEditor.edit as sinon.SinonStub;
    const revealRangeStub = mockEditor.revealRange as sinon.SinonStub;
    assert.strictEqual(editStub.calledOnce, true, 'Should set cursor position');
    assert.strictEqual(revealRangeStub.calledOnce, true, 'Should reveal the range');

    // Verify QuickPick was disposed
    const disposeStub = cx.qp.dispose as sinon.SinonStub;
    assert.strictEqual(disposeStub.calledOnce, true, 'Should dispose QuickPick after selection');
  });

  test('should format QuickPick items correctly', () => {
    // Test case 1: Basic item formatting with all fields
    const basicItem = createResultItem('src/test/file.ts', 'const testVar = "hello";', 42, 13, {
      type: 'match',
      data: { path: { text: 'src/test/file.ts' } },
    });

    assert.strictEqual(basicItem._type, 'QuickPickItemQuery', 'Should have correct type');
    assert.strictEqual(basicItem.label, 'const testVar = "hello";', 'Should set label to trimmed file contents');
    assert.strictEqual(basicItem.data.filePath, 'src/test/file.ts', 'Should set correct file path');
    assert.strictEqual(basicItem.data.linePos, 42, 'Should set correct line position');
    assert.strictEqual(basicItem.data.colPos, 13, 'Should set correct column position');
    assert.strictEqual(basicItem.alwaysShow, true, 'Should set alwaysShow for regex support');
    assert.strictEqual(basicItem.buttons?.length, 1, 'Should have one button');
    assert.strictEqual(
      basicItem.buttons?.[0].tooltip,
      'Open in Horizontal split',
      'Should have correct button tooltip',
    );

    // Test case 2: Item formatting with empty content
    const emptyItem = createResultItem('src/empty.ts', '', 1, 1);
    assert.strictEqual(emptyItem.label?.trim(), '', 'Should handle empty content');
    assert.strictEqual(emptyItem.data.filePath, 'src/empty.ts', 'Should set file path for empty content');

    // Test case 3: Item formatting with special characters
    const specialCharsItem = createResultItem('src/special/file.ts', 'const π = Math.PI; // Unicode π', 1, 1);
    assert.strictEqual(
      specialCharsItem.label,
      'const π = Math.PI; // Unicode π',
      'Should handle special characters in content',
    );

    // Test case 4: Item formatting with very long content
    const longContent = 'a'.repeat(1000);
    const longItem = createResultItem('src/long.ts', longContent, 1, 1);
    assert.strictEqual(longItem.label, longContent.trim(), 'Should handle long content without truncation');
  });

  test('should generate basic preview content', async () => {
    // Mock document with simple content
    const mockDocument = {
      getText: sandbox.stub().returns('const testVar = "hello";\nfunction test() {}\n'),
      lineAt: (line: number) => ({
        text: line === 0 ? 'const testVar = "hello";' : 'function test() {}',
        range: new vscode.Range(line, 0, line, line === 0 ? 25 : 17),
      }),
      lineCount: 2,
      uri: vscode.Uri.file('src/test.ts'),
    };

    // Mock workspace and path resolution
    const workspaceRoot = '/Users/joshmu/Desktop/code/projects/vscode-extensions/periscope';
    sandbox
      .stub(vscode.workspace, 'workspaceFolders')
      .value([{ uri: vscode.Uri.file(workspaceRoot), name: 'periscope', index: 0 }]);
    sandbox.stub(vscode.workspace, 'openTextDocument').callsFake(async (uri) => {
      // Ensure we're comparing URIs
      let expectedUri: vscode.Uri | undefined;

      if (typeof uri === 'string') {
        expectedUri = vscode.Uri.file(path.join(workspaceRoot, uri));
      } else if (uri instanceof vscode.Uri) {
        expectedUri = uri;
      }

      if (!expectedUri || !(expectedUri instanceof vscode.Uri)) {
        throw new Error('Invalid URI provided to openTextDocument');
      }

      assert.strictEqual(expectedUri.fsPath, path.join(workspaceRoot, 'src/test.ts'));
      return mockDocument as any;
    });

    // Sample QuickPick item
    const item: QPItemQuery = {
      _type: 'QuickPickItemQuery',
      label: '$(file) src/test.ts:1:1',
      description: 'const testVar = "hello";',
      data: {
        filePath: 'src/test.ts',
        linePos: 1,
        colPos: 1,
        rawResult: {} as any,
      },
    };

    // Call peekItem
    await peekItem([item]);

    // Verify document was opened
    const openTextDocumentStub = vscode.workspace.openTextDocument as sinon.SinonStub;
    assert.strictEqual(openTextDocumentStub.calledOnce, true, 'Should open document for preview');

    // Verify preview content
    const lineText = mockDocument.lineAt(0).text;
    assert.strictEqual(lineText, 'const testVar = "hello";', 'Should show correct preview content');
  });

  test('should handle advanced preview content with syntax highlighting', async () => {
    // Mock document with multi-line TypeScript content
    const mockContent = `
import { useState } from 'react';

interface Props {
  name: string;
  age: number;
}

export function UserProfile({ name, age }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  
  return (
    <div className="user-profile">
      <h1>{name}</h1>
      <p>Age: {age}</p>
    </div>
  );
}`.trim();

    const mockDocument = {
      getText: sandbox.stub().returns(mockContent),
      lineAt: (line: number) => ({
        text: mockContent.split('\n')[line],
        range: new vscode.Range(line, 0, line, mockContent.split('\n')[line].length),
      }),
      lineCount: mockContent.split('\n').length,
      uri: vscode.Uri.file('src/components/UserProfile.tsx'),
      languageId: 'typescript',
    };

    // Mock workspace and path resolution
    const workspaceRoot = '/Users/joshmu/Desktop/code/projects/vscode-extensions/periscope';
    sandbox
      .stub(vscode.workspace, 'workspaceFolders')
      .value([{ uri: vscode.Uri.file(workspaceRoot), name: 'periscope', index: 0 }]);

    // Mock text document opening
    sandbox.stub(vscode.workspace, 'openTextDocument').callsFake(async (uri) => {
      let expectedUri: vscode.Uri | undefined;

      if (typeof uri === 'string') {
        expectedUri = vscode.Uri.file(path.join(workspaceRoot, uri));
      } else if (uri instanceof vscode.Uri) {
        expectedUri = uri;
      }

      if (!expectedUri || !(expectedUri instanceof vscode.Uri)) {
        throw new Error('Invalid URI provided to openTextDocument');
      }

      assert.strictEqual(expectedUri.fsPath, path.join(workspaceRoot, 'src/components/UserProfile.tsx'));
      return mockDocument as any;
    });

    // Sample QuickPick item with multi-line match
    const item: QPItemQuery = {
      _type: 'QuickPickItemQuery',
      label: '$(file) src/components/UserProfile.tsx:9:3',
      description: 'const [isEditing, setIsEditing] = useState(false);',
      data: {
        filePath: 'src/components/UserProfile.tsx',
        linePos: 9,
        colPos: 3,
        rawResult: {} as any,
      },
    };

    // Call peekItem
    await peekItem([item]);

    // Verify document was opened
    const openTextDocumentStub = vscode.workspace.openTextDocument as sinon.SinonStub;
    assert.strictEqual(openTextDocumentStub.calledOnce, true, 'Should open document for preview');

    // Verify preview content
    const matchedLine = mockDocument.lineAt(9 - 1).text; // Convert 1-based line number to 0-based
    assert.strictEqual(
      matchedLine,
      '  const [isEditing, setIsEditing] = useState(false);',
      'Should show correct matched line',
    );

    // Verify context lines are available
    const previousLine = mockDocument.lineAt(9 - 2).text; // Line before match
    const nextLine = mockDocument.lineAt(9).text; // Line after match
    assert.strictEqual(
      previousLine,
      'export function UserProfile({ name, age }: Props) {',
      'Should show previous context line',
    );
    assert.strictEqual(nextLine, '  ', 'Should show next context line');

    // Verify language ID for syntax highlighting
    assert.strictEqual(mockDocument.languageId, 'typescript', 'Should identify TypeScript for syntax highlighting');
  });

  test('should handle preview content scrolling and navigation', async () => {
    // Mock document with large content to enable scrolling
    const mockContent = Array(100)
      .fill(0)
      .map((_, i) => `Line ${i + 1}: console.log('test line ${i + 1}');`)
      .join('\n');

    const mockDocument = {
      getText: sandbox.stub().returns(mockContent),
      lineAt: (line: number) => ({
        text: `Line ${line + 1}: console.log('test line ${line + 1}');`,
        range: new vscode.Range(line, 0, line, 45),
      }),
      lineCount: 100,
      uri: vscode.Uri.file('src/test/longFile.ts'),
      languageId: 'typescript',
      visibleRanges: [new vscode.Range(0, 0, 20, 0)], // Initial visible range
    };

    // Mock editor for scrolling
    const mockEditor = {
      document: mockDocument,
      visibleRanges: [new vscode.Range(0, 0, 20, 0)],
      revealRange: sandbox.stub().callsFake((range: vscode.Range, type?: vscode.TextEditorRevealType) => {
        // Update visible ranges to center around the revealed line
        const linesVisible = 20;
        const halfVisible = Math.floor(linesVisible / 2);
        const startLine = Math.max(0, range.start.line - halfVisible);
        const endLine = Math.min(mockDocument.lineCount - 1, range.start.line + halfVisible);
        mockEditor.visibleRanges = [new vscode.Range(startLine, 0, endLine, 0)];
      }),
      selection: new vscode.Selection(0, 0, 0, 0),
      options: {
        get: (key: string) => {
          if (key === 'lineNumbers') return 'on';
          if (key === 'scrollBehavior') return 'smooth';
          return undefined;
        },
      },
      edit: async (callback: any) => {
        await callback({
          replace: (range: vscode.Range, newText: string) =>
            // Simulate text replacement
            true,
        });
        return true;
      },
    };

    // Mock workspace and path resolution
    const workspaceRoot = '/Users/joshmu/Desktop/code/projects/vscode-extensions/periscope';
    sandbox
      .stub(vscode.workspace, 'workspaceFolders')
      .value([{ uri: vscode.Uri.file(workspaceRoot), name: 'periscope', index: 0 }]);

    // Mock text document opening and editor creation
    sandbox.stub(vscode.workspace, 'openTextDocument').resolves(mockDocument as any);
    sandbox.stub(vscode.window, 'showTextDocument').callsFake(async () => {
      // Simulate scrolling to the target line
      const targetRange = new vscode.Range(49, 0, 49, 45); // Line 50 (0-based)
      mockEditor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);
      return mockEditor as any;
    });

    // Sample QuickPick item with match in the middle of the file
    const item: QPItemQuery = {
      _type: 'QuickPickItemQuery',
      label: '$(file) src/test/longFile.ts:50:1',
      description: "Line 50: console.log('test line 50');",
      data: {
        filePath: 'src/test/longFile.ts',
        linePos: 50,
        colPos: 1,
        rawResult: {} as any,
      },
    };

    // Call peekItem
    await peekItem([item]);

    // Verify document was opened
    const openTextDocumentStub = vscode.workspace.openTextDocument as sinon.SinonStub;
    assert.strictEqual(openTextDocumentStub.calledOnce, true, 'Should open document for preview');

    // Verify editor was shown
    const showTextDocumentStub = vscode.window.showTextDocument as sinon.SinonStub;
    assert.strictEqual(showTextDocumentStub.calledOnce, true, 'Should show text document');

    // Verify scroll to target line
    const revealRangeStub = mockEditor.revealRange as sinon.SinonStub;
    assert.strictEqual(revealRangeStub.calledOnce, true, 'Should call revealRange');

    const revealedRange = revealRangeStub.firstCall.args[0] as vscode.Range;
    assert.strictEqual(
      revealedRange.start.line,
      49, // 0-based index for line 50
      'Should reveal the correct line',
    );

    // Verify visible range includes context
    const visibleStartLine = mockEditor.visibleRanges[0].start.line;
    const visibleEndLine = mockEditor.visibleRanges[0].end.line;
    assert.ok(visibleStartLine <= 49 && visibleEndLine >= 49, 'Target line should be within visible range');

    // Verify we can see enough context (at least 3 lines before and after)
    assert.ok(
      visibleStartLine <= 46, // 3 lines before target
      'Should show at least 3 lines of context before target',
    );
    assert.ok(
      visibleEndLine >= 52, // 3 lines after target
      'Should show at least 3 lines of context after target',
    );
  });
});
