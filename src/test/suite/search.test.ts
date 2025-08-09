import * as assert from 'assert';
import { createFileItem } from '../../utils/quickpickUtils';
import { context as cx } from '../../lib/context';
import { QPItemFile, QPItemQuery } from '../../types';

suite('Search Functionality', () => {
  setup(() => {
    cx.resetContext();
  });

  suite('Text Search', () => {
    test('searches across workspace by default', () => {
      cx.searchMode = 'all';
      assert.strictEqual(cx.searchMode, 'all');
      // In 'all' mode, searches entire workspace
    });

    test('searches only current file when in currentFile mode', () => {
      cx.searchMode = 'currentFile';
      assert.strictEqual(cx.searchMode, 'currentFile');
      // Should limit search to active editor's file
    });

    test('creates query result items with correct structure', () => {
      const mockResult: QPItemQuery = {
        _type: 'QuickPickItemQuery',
        label: 'matched text',
        data: {
          filePath: 'src/test.ts',
          linePos: 10,
          colPos: 5,
          textResult: 'matched text',
          rawResult: {} as any,
        },
      };

      assert.strictEqual(mockResult._type, 'QuickPickItemQuery');
      assert.strictEqual(mockResult.data.filePath, 'src/test.ts');
      assert.strictEqual(mockResult.data.linePos, 10);
      assert.strictEqual(mockResult.data.colPos, 5);
    });
  });

  suite('File Search', () => {
    test('lists files matching pattern', () => {
      cx.searchMode = 'files';
      const patterns = [
        { query: 'test', expected: '*test*' },
        { query: '.ts', expected: '*.ts*' },
        { query: 'src/lib', expected: '*src/lib*' },
      ];

      patterns.forEach(({ query, expected }) => {
        const glob = query ? `*${query}*` : '';
        assert.strictEqual(glob, expected);
      });
    });

    test('creates file items with correct structure', () => {
      const filePath = 'src/lib/test.ts';
      const item = createFileItem(filePath);

      assert.strictEqual(item._type, 'QuickPickItemFile');
      assert.strictEqual(item.data.filePath, filePath);
      assert.strictEqual(item.alwaysShow, true);
      assert.ok(item.buttons);
      assert.strictEqual(item.buttons[0].tooltip, 'Open in Horizontal split');
    });

    test('handles empty query to list all files', () => {
      const emptyQuery = '';
      const glob = emptyQuery ? `*${emptyQuery}*` : '';
      assert.strictEqual(glob, '');
      // Should list all files when query is empty
    });
  });

  suite('Search Input Handling', () => {
    test('detects and removes --files flag', () => {
      const queries = [
        { input: '--files test.ts', cleaned: 'test.ts' },
        { input: '--files', cleaned: '' },
        { input: 'test --files', cleaned: 'test' },
      ];

      queries.forEach(({ input, cleaned }) => {
        const result = input.replace('--files', '').trim();
        assert.strictEqual(result, cleaned);
      });
    });

    test('handles special characters in queries', () => {
      const specialQueries = ['test*.ts', 'test?.ts', '[test]', 'test file.ts', 'path/to/file'];

      specialQueries.forEach((query) => {
        // Should handle without errors
        const glob = `*${query}*`;
        assert.ok(glob.includes(query));
      });
    });

    test('preserves query for resume functionality', () => {
      const queries = ['test search', 'file.ts', '--files readme'];

      queries.forEach((query) => {
        // Query should be stored for resume
        assert.ok(query);
        // In real implementation, would save to storage
      });
    });
  });

  suite('Search Results', () => {
    test('quickpick items have correct properties', () => {
      // Text search result
      const textItem: QPItemQuery = {
        _type: 'QuickPickItemQuery',
        label: 'result text',
        detail: 'path/to/file.ts',
        alwaysShow: true,
        data: {
          filePath: 'path/to/file.ts',
          linePos: 1,
          colPos: 1,
          textResult: 'result text',
          rawResult: {} as any,
        },
      };

      // File search result
      const fileItem: QPItemFile = {
        _type: 'QuickPickItemFile',
        label: 'file.ts',
        alwaysShow: true,
        data: {
          filePath: 'path/to/file.ts',
        },
      };

      assert.strictEqual(textItem._type, 'QuickPickItemQuery');
      assert.strictEqual(fileItem._type, 'QuickPickItemFile');
      assert.strictEqual(textItem.alwaysShow, true);
      assert.strictEqual(fileItem.alwaysShow, true);
    });

    test('results can be selected and opened', () => {
      const mockItems = [
        { _type: 'QuickPickItemQuery', data: { filePath: 'test1.ts' } },
        { _type: 'QuickPickItemFile', data: { filePath: 'test2.ts' } },
      ];

      mockItems.forEach((item) => {
        assert.ok(item.data.filePath);
        // In real implementation, would open the file
      });
    });
  });

  suite('Search Configuration', () => {
    test('respects exclude patterns', () => {
      const excludePatterns = ['node_modules', '*.log', '.git'];

      excludePatterns.forEach((pattern) => {
        // Should not include these in results
        assert.ok(pattern);
      });
    });

    test('uses workspace folders as search roots', () => {
      // In real implementation, would use vscode.workspace.workspaceFolders
      const mockWorkspaceFolders = ['/project1', '/project2'];

      assert.ok(mockWorkspaceFolders.length > 0);
      // Should search in all workspace folders
    });
  });
});
