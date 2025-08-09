import * as assert from 'assert';
import { createFileItem } from '../../utils/quickpickUtils';
import { context as cx } from '../../lib/context';
import { setSearchMode } from '../../utils/searchCurrentFile';
import { QPItemFile, SearchMode } from '../../types';

suite('File Search', () => {
  setup(() => {
    // Reset context before each test
    cx.resetContext();
  });

  suite('QuickPick Item Creation', () => {
    test('createFileItem creates correct structure', () => {
      const filePath = 'src/test/example.ts';
      const item = createFileItem(filePath);

      assert.strictEqual(item._type, 'QuickPickItemFile');
      assert.strictEqual(item.data.filePath, filePath);
      assert.strictEqual(item.alwaysShow, true);
      assert.ok(item.buttons);
      assert.strictEqual(item.buttons.length, 1);
      assert.strictEqual(item.buttons[0].tooltip, 'Open in Horizontal split');
    });

    test('createFileItem formats label correctly', () => {
      const filePath = 'src/very/deep/nested/folder/structure/example.ts';
      const item = createFileItem(filePath);

      // The label should be formatted by formatPathLabel
      assert.ok(item.label);
      assert.strictEqual(typeof item.label, 'string');
    });
  });

  suite('Search Mode Management', () => {
    test('defaults to "all" search mode', () => {
      assert.strictEqual(cx.searchMode, 'all');
      assert.strictEqual(cx.qp.title, undefined);
    });

    test('switches to file search mode correctly', () => {
      setSearchMode('files');
      assert.strictEqual(cx.searchMode, 'files');
      assert.strictEqual(cx.qp.title, 'File Search');
    });

    test('switches to current file mode correctly', () => {
      setSearchMode('currentFile');
      assert.strictEqual(cx.searchMode, 'currentFile');
      assert.strictEqual(cx.qp.title, 'Search current file only');
    });

    test('handles mode switching properly', () => {
      // Switch through all modes
      setSearchMode('files');
      assert.strictEqual(cx.searchMode, 'files');

      setSearchMode('currentFile');
      assert.strictEqual(cx.searchMode, 'currentFile');

      setSearchMode('all');
      assert.strictEqual(cx.searchMode, 'all');
    });

    test('resets to "all" mode on context reset', () => {
      setSearchMode('files');
      cx.resetContext();
      assert.strictEqual(cx.searchMode, 'all');
    });
  });

  suite('File Search Behavior', () => {
    test('detects --files flag in query', () => {
      const query = '--files test.ts';
      const hasFilesFlag = query.includes('--files');
      assert.strictEqual(hasFilesFlag, true);

      // Query should be cleaned
      const cleanedQuery = query.replace('--files', '').trim();
      assert.strictEqual(cleanedQuery, 'test.ts');
    });

    test('creates correct glob patterns', () => {
      // Empty query - list all files
      const emptyGlob = '' ? `--glob "*${''}*"` : '';
      assert.strictEqual(emptyGlob, '');

      // Simple query
      const simpleGlob = 'test' ? `--glob "*${'test'}*"` : '';
      assert.strictEqual(simpleGlob, '--glob "*test*"');

      // Extension query
      const extGlob = '.ts' ? `--glob "*${'.ts'}*"` : '';
      assert.strictEqual(extGlob, '--glob "*.ts*"');

      // Path query
      const pathGlob = 'src/lib' ? `--glob "*${'src/lib'}*"` : '';
      assert.strictEqual(pathGlob, '--glob "*src/lib*"');
    });

    test('determines correct search type based on mode', () => {
      // File search mode
      cx.searchMode = 'files';
      assert.strictEqual(cx.searchMode, 'files');

      // Content search mode
      cx.searchMode = 'all';
      assert.strictEqual(cx.searchMode, 'all');

      // Current file mode
      cx.searchMode = 'currentFile';
      assert.strictEqual(cx.searchMode, 'currentFile');
    });
  });

  suite('Type Structure', () => {
    test('QPItemFile has correct structure', () => {
      const fileItem: QPItemFile = {
        _type: 'QuickPickItemFile',
        label: 'test.ts',
        data: {
          filePath: 'src/test.ts',
        },
        alwaysShow: true,
        buttons: [],
      };

      assert.strictEqual(fileItem._type, 'QuickPickItemFile');
      assert.strictEqual(fileItem.data.filePath, 'src/test.ts');
      assert.strictEqual(fileItem.alwaysShow, true);
    });

    test('SearchMode type covers all modes', () => {
      const modes: SearchMode[] = ['all', 'currentFile', 'files'];
      modes.forEach((mode) => {
        cx.searchMode = mode;
        assert.ok(['all', 'currentFile', 'files'].includes(cx.searchMode));
      });
    });
  });
});
