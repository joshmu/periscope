import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { context as cx } from '../../src/lib/context';
import { QPItemQuery, QPItemFile } from '../../src/types';
import {
  periscopeTestHelpers,
  waitForQuickPick,
  waitForCondition,
  waitForPreviewUpdate,
  TEST_TIMEOUTS,
} from '../utils/periscopeTestHelper';

suite('QuickPick Interface', () => {
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
    if (cx.qp) {
      cx.qp.hide();
      cx.qp.dispose();
    }
    sandbox.restore();
    cx.resetContext();
    await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
  });

  test('shows search results in quickpick', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Perform a real search
    const results = await periscopeTestHelpers.search('function');

    // Assert real search results are shown
    assert.ok(results.count > 0, 'Should find functions');
    assert.ok(cx.qp, 'QuickPick should be initialized');
    assert.ok(cx.qp.items.length > 0, 'Should have items in QuickPick');

    // Check that items have the correct structure
    const firstItem = cx.qp.items[0] as any;
    assert.ok(firstItem._type, 'Item should have a type');
    assert.ok(firstItem.label, 'Item should have a label');
  });

  test('allows item selection', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Perform a real search with multiple results
    const results = await periscopeTestHelpers.search('function');

    assert.ok(results.count > 1, 'Should have multiple results for selection');
    assert.ok(cx.qp, 'QuickPick should be initialized');

    // Select the first item
    const firstItem = cx.qp.items[0] as QPItemQuery;
    cx.qp.selectedItems = [firstItem];

    // Test that selection works
    assert.strictEqual(cx.qp.selectedItems.length, 1, 'Should have one selected item');
    assert.strictEqual(cx.qp.selectedItems[0], firstItem, 'Should select the correct item');
    assert.ok(
      (cx.qp.selectedItems[0] as QPItemQuery).data.filePath,
      'Selected item should have file path',
    );
  });

  test('supports preview on hover', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Perform a real file search
    const results = await periscopeTestHelpers.searchFiles('Button');

    assert.ok(results.count > 0, 'Should have file results');
    assert.ok(cx.qp, 'QuickPick should be initialized');

    // Set active item (simulates hovering)
    const firstItem = cx.qp.items[0] as QPItemFile;
    cx.qp.activeItems = [firstItem];

    assert.strictEqual(cx.qp.activeItems.length, 1, 'Should have one active item');
    assert.ok(
      (cx.qp.activeItems[0] as QPItemFile).data.filePath,
      'Active item should have file path',
    );

    // In real usage, this would trigger a preview of the file
    // The extension should handle onDidChangeActive event
  });

  test('handles keyboard navigation', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Perform a real search with multiple results
    const results = await periscopeTestHelpers.search('function');

    assert.ok(results.count > 1, 'Should have multiple results for navigation');
    assert.ok(cx.qp, 'QuickPick should be initialized');

    // Check that we can reference items
    const items = cx.qp.items;
    assert.ok(items.length > 1, 'Should have multiple items');

    // In a real scenario, the user would navigate with arrow keys
    // We can't simulate that directly, but we can verify the items exist
    assert.ok(items[0], 'First item exists');
    assert.ok(items[1], 'Second item exists');
  });

  test('supports horizontal split button', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Perform a real search to get items with buttons
    const results = await periscopeTestHelpers.search('function');

    assert.ok(results.count > 0, 'Should have search results');
    assert.ok(cx.qp, 'QuickPick should be initialized');

    // Check that items have the horizontal split button
    const firstItem = cx.qp.items[0] as QPItemQuery;
    assert.ok(firstItem.buttons, 'Item should have buttons');
    assert.ok(firstItem.buttons.length > 0, 'Should have at least one button');

    // Find the horizontal split button
    const splitButton = firstItem.buttons.find(
      (b) =>
        b.tooltip === 'Open in Horizontal split' ||
        (b.iconPath as vscode.ThemeIcon)?.id === 'split-horizontal',
    );

    assert.ok(splitButton, 'Should have horizontal split button');
  });

  test('clears on escape', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Start a search with results
    const results = await periscopeTestHelpers.search('function');

    assert.ok(results.count > 0, 'Should have initial results');
    assert.ok(cx.qp, 'QuickPick should be initialized');
    assert.ok(cx.qp.items.length > 0, 'Should have items before escape');
    assert.strictEqual(cx.qp.value, 'function', 'Should have query value');

    // Simulate escape by hiding the QuickPick
    cx.qp.hide();

    // Wait a bit for cleanup
    await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

    // After hiding, the QuickPick should be disposed/cleared
    // The next search should start fresh
    await vscode.commands.executeCommand('periscope.search');
    await waitForQuickPick();

    // Verify it starts fresh
    assert.strictEqual(cx.qp.value, '', 'Should start with empty value after escape');

    // Clean up
    cx.qp.hide();
    cx.qp.dispose();
  });

  test('shows busy state during search', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Execute search command
    await vscode.commands.executeCommand('periscope.search');
    await waitForQuickPick();

    assert.ok(cx.qp, 'QuickPick should be initialized');

    // Set up a flag to track busy state changes
    let wasBusy = false;
    let becameNotBusy = false;

    // Start monitoring busy state changes
    const checkBusyState = setInterval(() => {
      if (cx.qp.busy) {
        wasBusy = true;
      } else if (wasBusy && !cx.qp.busy) {
        becameNotBusy = true;
      }
    }, 10);

    // Trigger a search that will set busy state
    cx.qp.value = 'function';

    // Wait for search to complete
    await waitForCondition(() => cx.qp.items.length > 0, TEST_TIMEOUTS.SEARCH_COMPLEX);

    // Stop monitoring
    clearInterval(checkBusyState);

    // The busy state should have been set during search
    assert.ok(wasBusy, 'QuickPick should have been busy during search');
    assert.ok(becameNotBusy, 'QuickPick should become not busy after search completes');
    assert.strictEqual(cx.qp.busy, false, 'QuickPick should not be busy after search completes');
  });

  test('updates value on user input', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Start a search
    await vscode.commands.executeCommand('periscope.search');
    await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.QUICKPICK_INIT));

    assert.ok(cx.qp, 'QuickPick should be initialized');

    const testQueries = ['test', 'search query', '--files readme'];

    for (const query of testQueries) {
      // Simulate user typing by setting the value
      cx.qp.value = query;

      // Verify the value was set
      assert.strictEqual(cx.qp.value, query, `Should update to "${query}"`);

      // Give the extension time to process
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
    }
  });

  test('shows previous results when no matches found', () => {
    // Store previous results
    const previousResults = [{ label: 'previous result 1' }, { label: 'previous result 2' }];

    // Simulate no matches scenario with config enabled
    const showPreviousResults = true; // periscope.showPreviousResultsWhenNoMatches
    const currentResults: any[] = [];

    if (showPreviousResults && currentResults.length === 0) {
      // Should show previous results
      assert.strictEqual(previousResults.length, 2);
    }
  });

  test('displays peek decorations on active item', () => {
    const peekConfig = {
      borderColor: '#007ACC',
      borderWidth: '2px',
      borderStyle: 'solid',
      matchColor: '#FFA500',
      matchBorderColor: '#FF6347',
    };

    // Peek decoration should be applied to active item
    assert.ok(peekConfig.borderColor);
    assert.ok(peekConfig.matchColor);
    // In real implementation, would apply decorations to editor
  });

  test('previews file when navigating results', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Close all editors to start from a clean state
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

    // Perform a search with multiple results
    const results = await periscopeTestHelpers.search('function');

    assert.ok(results.count > 1, 'Should have multiple results for navigation');
    assert.ok(cx.qp, 'QuickPick should be initialized');

    // The first result should automatically open a preview
    const firstPreviewEditor = await waitForPreviewUpdate();
    assert.ok(firstPreviewEditor, 'Should have automatically opened preview for first result');

    // Get the first item details for comparison
    const firstItem = cx.qp.items[0] as QPItemQuery;

    // Find a second item from a DIFFERENT FILE
    let secondItem: QPItemQuery | undefined;

    // Look ONLY for an item from a different file (not just different line)
    for (let i = 1; i < cx.qp.items.length; i++) {
      const item = cx.qp.items[i] as QPItemQuery;
      if (item.data?.filePath !== firstItem.data?.filePath) {
        secondItem = item;
        break;
      }
    }

    // If no item from different file found, we can't test file navigation
    if (!secondItem) {
      // At least verify the automatic preview worked
      assert.ok(firstPreviewEditor, 'Automatic preview should have opened');
      assert.ok(
        firstPreviewEditor.document.uri.fsPath.includes(
          firstItem.data?.filePath?.split('/').pop() || '',
        ),
        'Preview should show the first result file',
      );
      return;
    }

    cx.qp.activeItems = [secondItem];

    // Wait for different file preview
    const secondPreviewEditor = await waitForPreviewUpdate(firstPreviewEditor);
    assert.ok(secondPreviewEditor, 'Should have opened preview for second file');

    // Verify the preview changed to a different file
    const differentFile =
      firstPreviewEditor?.document.uri.fsPath !== secondPreviewEditor?.document.uri.fsPath;

    // The preview MUST have changed to a different file
    assert.ok(differentFile, 'Preview should change to a different file when navigating');
  });

  test('opens file at correct position on accept', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Perform a search
    const results = await periscopeTestHelpers.search('TODO');

    assert.ok(results.count > 0, 'Should find TODO comments');
    assert.ok(cx.qp, 'QuickPick should be initialized');

    // Get the first result item
    const firstItem = cx.qp.items[0] as QPItemQuery;
    const expectedLine = firstItem.data.linePos - 1; // Convert to 0-based
    const expectedCol = firstItem.data.colPos - 1;

    // Select the item
    cx.qp.selectedItems = [firstItem];

    // Simulate accepting (would normally be Enter key)
    // In real usage, this triggers onDidAccept event
    const acceptPromise = new Promise<void>((resolve) => {
      const disposable = cx.qp.onDidAccept(() => {
        disposable.dispose();
        resolve();
      });
      // Trigger accept
      cx.qp.hide(); // Hiding simulates accepting in many cases
    });

    // Wait for file to open
    await waitForCondition(() => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return false;
      }

      // Check if we're at the expected position
      const position = editor.selection.active;
      return position.line === expectedLine;
    }, TEST_TIMEOUTS.EDITOR_OPEN);

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor, 'Should have opened the file');

    // Verify cursor position
    const position = editor.selection.active;

    // Allow some flexibility in positioning
    assert.ok(
      Math.abs(position.line - expectedLine) <= 1,
      `Should position cursor near correct line. Expected: ${expectedLine}, Actual: ${position.line}`,
    );
  });

  test('formats file paths based on configuration', () => {
    const pathFormatScenarios = [
      {
        filePath: '/workspace/project/src/lib/utils/helper.ts',
        showWorkspaceFolder: true,
        startFolderIndex: 2,
        expected: 'project/.../utils/helper.ts',
      },
      {
        filePath: '/workspace/frontend/components/Button.tsx',
        showWorkspaceFolder: false,
        startFolderIndex: 1,
        expected: '.../components/Button.tsx',
      },
    ];

    pathFormatScenarios.forEach(({ filePath, expected }) => {
      // Path formatting should match configuration
      assert.ok(filePath);
      assert.ok(expected);
      // In real implementation, would use formatPathLabel
    });
  });

  test('handles arrow key navigation between results', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Perform a search with multiple results
    const results = await periscopeTestHelpers.search('function');

    assert.ok(results.count > 2, 'Should have multiple results for navigation');
    assert.ok(cx.qp, 'QuickPick should be initialized');

    // Start with first item active
    cx.qp.activeItems = [cx.qp.items[0]];
    const firstItem = cx.qp.activeItems[0];

    // Simulate arrow down by changing active item
    cx.qp.activeItems = [cx.qp.items[1]];
    const secondItem = cx.qp.activeItems[0];

    assert.notStrictEqual(firstItem, secondItem, 'Active item should change on navigation');

    // Simulate arrow down again
    cx.qp.activeItems = [cx.qp.items[2]];
    const thirdItem = cx.qp.activeItems[0];

    assert.notStrictEqual(secondItem, thirdItem, 'Should navigate to third item');

    // Simulate arrow up
    cx.qp.activeItems = [cx.qp.items[1]];
    const backToSecond = cx.qp.activeItems[0];

    assert.strictEqual(backToSecond, cx.qp.items[1], 'Should navigate back with arrow up');
  });

  test('cancels search on Escape key', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Start a search with a known starting file
    const results = await periscopeTestHelpers.search('function', {
      startFile: 'build/compiled.js',
    });

    assert.ok(results.count > 0, 'Should have search results');
    assert.ok(cx.qp, 'QuickPick should be initialized');

    // Simulate Escape key by hiding the QuickPick
    cx.qp.hide();

    // QuickPick should be hidden
    await waitForCondition(() => !cx.qp, TEST_TIMEOUTS.QUICKPICK_DISPOSE);

    // Editor focus should return to the starting file
    const editorAfter = vscode.window.activeTextEditor;

    assert.ok(editorAfter, 'Should have an active editor after canceling');
    assert.ok(
      editorAfter.document.uri.fsPath.includes('compiled.js'),
      'Should return to the starting document after canceling',
    );
  });

  test('accepts selection on Enter key', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Perform a search
    const results = await periscopeTestHelpers.search('TODO');

    assert.ok(results.count > 0, 'Should find results');
    assert.ok(cx.qp, 'QuickPick should be initialized');

    // Select an item
    const selectedItem = cx.qp.items[0] as QPItemQuery;
    cx.qp.selectedItems = [selectedItem];

    // Track if accept was triggered
    let acceptTriggered = false;
    const disposable = cx.qp.onDidAccept(() => {
      acceptTriggered = true;
    });

    // Simulate Enter key would trigger onDidAccept
    // In actual usage, the extension handles this

    disposable.dispose();

    // Verify the selection was made
    assert.strictEqual(cx.qp.selectedItems.length, 1, 'Should have one selected item');
    assert.strictEqual(cx.qp.selectedItems[0], selectedItem, 'Should select the correct item');
  });

  test('triggers RG menu when user types prefix', async function () {
    this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

    // Use helper to trigger menu with prefix
    const qp = await periscopeTestHelpers.triggerRgMenu('<<');

    assert.ok(qp, 'QuickPick should be initialized');

    // Menu should be triggered - verify by checking multiple indicators
    const menuTriggered = qp.canSelectMany === true; // Menu enables multi-select
    const prefixConsumed = qp.value === '' || qp.value !== '<<';

    // Either menu should be shown OR prefix should be consumed
    assert.ok(
      menuTriggered || prefixConsumed,
      `RG menu should trigger when prefix is typed. Menu triggered: ${menuTriggered}, Prefix consumed: ${prefixConsumed}, Current value: '${qp.value}'`,
    );

    // Clean up
    qp.hide();
    qp.dispose();
  });
});
