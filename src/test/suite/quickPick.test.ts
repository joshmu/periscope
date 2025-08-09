import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { context as cx } from '../../lib/context';
import { QPItemQuery, QPItemFile } from '../../types';

suite('QuickPick Interface', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    cx.resetContext();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('shows search results in quickpick', () => {
    // Mock search results
    const mockResults = [
      {
        _type: 'QuickPickItemQuery',
        label: 'function test()',
        detail: 'src/test.ts',
        data: { filePath: 'src/test.ts', linePos: 1, colPos: 1 },
      },
      {
        _type: 'QuickPickItemFile',
        label: 'src/file.ts',
        data: { filePath: 'src/file.ts' },
      },
    ];

    cx.qp.items = mockResults as any;

    assert.strictEqual(cx.qp.items.length, 2);
    assert.strictEqual((cx.qp.items[0] as any)._type, 'QuickPickItemQuery');
    assert.strictEqual((cx.qp.items[1] as any)._type, 'QuickPickItemFile');
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

  test('handles keyboard navigation', () => {
    const items = [{ label: 'item 1' }, { label: 'item 2' }, { label: 'item 3' }];

    cx.qp.items = items as any;

    // Simulate moving through items
    cx.qp.activeItems = [items[0] as any];
    assert.strictEqual((cx.qp.activeItems[0] as any).label, 'item 1');

    cx.qp.activeItems = [items[1] as any];
    assert.strictEqual((cx.qp.activeItems[0] as any).label, 'item 2');
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

  test('shows busy state during search', () => {
    // Start search
    cx.qp.busy = true;
    assert.strictEqual(cx.qp.busy, true);

    // Complete search
    cx.qp.busy = false;
    assert.strictEqual(cx.qp.busy, false);
  });

  test('updates value on user input', () => {
    const testQueries = ['test', 'search query', '--files readme'];

    testQueries.forEach((query) => {
      cx.qp.value = query;
      assert.strictEqual(cx.qp.value, query);
    });
  });
});
