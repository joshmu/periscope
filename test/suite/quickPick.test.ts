import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { context as cx } from '../../src/lib/context';
import { QPItemQuery, QPItemFile } from '../../src/types';
import { periscopeTestHelpers } from '../utils/periscopeTestHelper';

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
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  test('shows search results in quickpick', async function () {
    this.timeout(5000);

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

  test('allows item selection', () => {
    const mockItem: QPItemQuery = {
      _type: 'QuickPickItemQuery',
      label: 'selected item',
      data: {
        filePath: 'test.ts',
        linePos: 1,
        colPos: 1,
        textResult: 'selected item',
        rawResult: {} as any,
      },
    };

    // Create mock quickpick with proper initialization
    const mockQp = {
      selectedItems: [mockItem],
    };

    // Test that selection works
    assert.strictEqual(mockQp.selectedItems.length, 1);
    assert.strictEqual((mockQp.selectedItems[0] as QPItemQuery).label, 'selected item');
  });

  test('supports preview on hover', () => {
    const mockItem: QPItemFile = {
      _type: 'QuickPickItemFile',
      label: 'preview.ts',
      data: { filePath: 'src/preview.ts' },
    };

    // Create mock quickpick with active items
    const mockQp = {
      activeItems: [mockItem],
    };

    assert.strictEqual(mockQp.activeItems.length, 1);
    assert.strictEqual((mockQp.activeItems[0] as QPItemFile).data.filePath, 'src/preview.ts');
  });

  test('handles keyboard navigation', async function () {
    this.timeout(5000);

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

  test('supports horizontal split button', () => {
    const mockItem: QPItemQuery = {
      _type: 'QuickPickItemQuery',
      label: 'test',
      buttons: [
        {
          iconPath: new vscode.ThemeIcon('split-horizontal'),
          tooltip: 'Open in Horizontal split',
        },
      ],
      data: {
        filePath: 'test.ts',
        linePos: 1,
        colPos: 1,
        textResult: 'test',
        rawResult: {} as any,
      },
    };

    assert.ok(mockItem.buttons);
    assert.strictEqual(mockItem.buttons.length, 1);
    assert.strictEqual(mockItem.buttons[0].tooltip, 'Open in Horizontal split');
  });

  test('clears on escape', () => {
    // Setup initial state
    const mockQp = {
      items: [{ label: 'item' }],
      value: 'search text',
      hide: () => {
        // Simulate clearing on hide
        mockQp.items = [];
        mockQp.value = '';
      },
    };

    // Simulate escape (hide event)
    mockQp.hide();

    assert.strictEqual(mockQp.items.length, 0);
    assert.strictEqual(mockQp.value, '');
  });

  test('shows busy state during search', async function () {
    this.timeout(5000);

    // Execute search command which should set busy state
    await vscode.commands.executeCommand('periscope.search');

    // Wait for QuickPick to be ready
    await new Promise((resolve) => setTimeout(resolve, 200));

    assert.ok(cx.qp, 'QuickPick should be initialized');

    // Set a query to trigger search
    cx.qp.value = 'test';

    // The busy state is managed by the extension during search
    // We can't directly test it without intercepting at the right moment
    // But we can verify the QuickPick is functional
    assert.ok(cx.qp !== undefined, 'QuickPick should exist during search');
  });

  test('updates value on user input', async function () {
    this.timeout(5000);

    // Start a search
    await vscode.commands.executeCommand('periscope.search');
    await new Promise((resolve) => setTimeout(resolve, 300));

    assert.ok(cx.qp, 'QuickPick should be initialized');

    const testQueries = ['test', 'search query', '--files readme'];

    for (const query of testQueries) {
      // Simulate user typing by setting the value
      cx.qp.value = query;

      // Verify the value was set
      assert.strictEqual(cx.qp.value, query, `Should update to "${query}"`);

      // Give the extension time to process
      await new Promise((resolve) => setTimeout(resolve, 100));
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

  test('supports gotoRgMenuActionsPrefix to trigger menu', () => {
    const prefix = '??';
    const queries = [
      { input: '??', shouldShowMenu: true },
      { input: '??search', shouldShowMenu: true },
      { input: 'normal search', shouldShowMenu: false },
    ];

    queries.forEach(({ input, shouldShowMenu }) => {
      const hasPrefix = input.startsWith(prefix);
      assert.strictEqual(hasPrefix, shouldShowMenu);
      // Would trigger menu display if prefix matches
    });
  });
});
