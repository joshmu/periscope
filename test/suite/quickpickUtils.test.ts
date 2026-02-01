import * as assert from 'assert';
import * as vscode from 'vscode';
import { createResultItem, createFileItem } from '../../src/utils/quickpickUtils';
import { RgMatchResult, RgMatchRawResult } from '../../src/types/ripgrep';
import { TEST_TIMEOUTS } from '../utils/periscopeTestHelper';

/* eslint-disable @typescript-eslint/naming-convention */
// Ripgrep JSON output uses snake_case for properties (line_number, absolute_offset)

suite('quickpickUtils - Unit Tests', function () {
  this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

  setup(async () => {
    // Ensure extension is activated
    const ext = vscode.extensions.getExtension('JoshMu.periscope');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  suite('createResultItem', () => {
    function createMockRawResult(overrides?: Partial<RgMatchRawResult>): RgMatchRawResult {
      return {
        type: 'match',
        data: {
          path: { text: '/home/user/project/file.ts' },
          lines: { text: 'function test() {}' },
          line_number: 10,
          absolute_offset: 100,
          submatches: [{ start: 0, end: 8, match: { text: 'function' } }],
        },
        ...overrides,
      };
    }

    function createMockSearchResult(overrides?: Partial<RgMatchResult>): RgMatchResult {
      return {
        filePath: '/home/user/project/file.ts',
        linePos: 10,
        colPos: 1,
        textResult: 'function test() {}',
        rawResult: createMockRawResult(),
        ...overrides,
      };
    }

    test('creates QuickPickItemQuery with correct type', () => {
      const searchResult = createMockSearchResult();
      const item = createResultItem(searchResult);

      assert.strictEqual(item._type, 'QuickPickItemQuery');
    });

    test('sets label to trimmed text result', () => {
      const searchResult = createMockSearchResult({
        textResult: '  function test() {}  ',
      });
      const item = createResultItem(searchResult);

      assert.strictEqual(item.label, 'function test() {}');
    });

    test('preserves search result data', () => {
      const searchResult = createMockSearchResult({
        filePath: '/path/to/file.ts',
        linePos: 42,
        colPos: 5,
      });
      const item = createResultItem(searchResult);

      assert.strictEqual(item.data.filePath, '/path/to/file.ts');
      assert.strictEqual(item.data.linePos, 42);
      assert.strictEqual(item.data.colPos, 5);
    });

    test('sets detail with formatted path and line number', () => {
      const searchResult = createMockSearchResult({
        filePath: vscode.workspace.rootPath + '/src/utils/helpers.ts',
        linePos: 25,
      });
      const item = createResultItem(searchResult);

      assert.ok(item.detail, 'Should have detail');
      assert.ok(
        item.detail!.includes('helpers.ts'),
        `Detail should include filename: ${item.detail}`,
      );
    });

    test('sets alwaysShow to true for regex support', () => {
      const searchResult = createMockSearchResult();
      const item = createResultItem(searchResult);

      assert.strictEqual(item.alwaysShow, true);
    });

    test('includes horizontal split button', () => {
      const searchResult = createMockSearchResult();
      const item = createResultItem(searchResult);

      assert.ok(item.buttons, 'Should have buttons');
      assert.strictEqual(item.buttons!.length, 1);
      assert.strictEqual(item.buttons![0].tooltip, 'Open in Horizontal split');
    });

    test('button has split-horizontal icon', () => {
      const searchResult = createMockSearchResult();
      const item = createResultItem(searchResult);

      const button = item.buttons![0];
      assert.ok(button.iconPath instanceof vscode.ThemeIcon);
      assert.strictEqual((button.iconPath as vscode.ThemeIcon).id, 'split-horizontal');
    });

    test('handles empty text result', () => {
      const searchResult = createMockSearchResult({
        textResult: '',
      });
      const item = createResultItem(searchResult);

      assert.strictEqual(item.label, '');
    });

    test('handles multiline text result', () => {
      const searchResult = createMockSearchResult({
        textResult: 'line 1\nline 2\nline 3',
      });
      const item = createResultItem(searchResult);

      // Label should be the trimmed version
      assert.ok(item.label!.includes('line 1'));
    });

    test('handles special characters in text result', () => {
      const searchResult = createMockSearchResult({
        textResult: 'const regex = /[a-z]+/g;',
      });
      const item = createResultItem(searchResult);

      assert.strictEqual(item.label, 'const regex = /[a-z]+/g;');
    });

    test('handles unicode in text result', () => {
      const searchResult = createMockSearchResult({
        textResult: 'const message = "你好世界";',
      });
      const item = createResultItem(searchResult);

      assert.strictEqual(item.label, 'const message = "你好世界";');
    });

    test('handles very long text result', () => {
      const longText = 'a'.repeat(500);
      const searchResult = createMockSearchResult({
        textResult: longText,
      });
      const item = createResultItem(searchResult);

      assert.strictEqual(item.label, longText);
    });

    test('preserves raw result reference', () => {
      const rawResult = createMockRawResult();
      const searchResult = createMockSearchResult({ rawResult });
      const item = createResultItem(searchResult);

      assert.strictEqual(item.data.rawResult, rawResult);
    });
  });

  suite('createFileItem', () => {
    test('creates QuickPickItemFile with correct type', () => {
      const item = createFileItem('/path/to/file.ts');

      assert.strictEqual(item._type, 'QuickPickItemFile');
    });

    test('sets label with formatted path', () => {
      const workspaceRoot = vscode.workspace.rootPath || '';
      const filePath = workspaceRoot + '/src/utils/helpers.ts';
      const item = createFileItem(filePath);

      assert.ok(item.label, 'Should have label');
      assert.ok(
        item.label.includes('helpers.ts') || item.label.includes('utils'),
        `Label should include filename: ${item.label}`,
      );
    });

    test('stores file path in data', () => {
      const filePath = '/path/to/file.ts';
      const item = createFileItem(filePath);

      assert.strictEqual(item.data.filePath, filePath);
    });

    test('sets alwaysShow to true', () => {
      const item = createFileItem('/path/to/file.ts');

      assert.strictEqual(item.alwaysShow, true);
    });

    test('includes horizontal split button', () => {
      const item = createFileItem('/path/to/file.ts');

      assert.ok(item.buttons, 'Should have buttons');
      assert.strictEqual(item.buttons!.length, 1);
      assert.strictEqual(item.buttons![0].tooltip, 'Open in Horizontal split');
    });

    test('button has split-horizontal icon', () => {
      const item = createFileItem('/path/to/file.ts');

      const button = item.buttons![0];
      assert.ok(button.iconPath instanceof vscode.ThemeIcon);
      assert.strictEqual((button.iconPath as vscode.ThemeIcon).id, 'split-horizontal');
    });

    test('handles path with spaces', () => {
      const filePath = '/path/to/folder with spaces/file with spaces.ts';
      const item = createFileItem(filePath);

      assert.strictEqual(item.data.filePath, filePath);
      assert.ok(item.label.includes('file with spaces.ts') || item.label.includes('spaces'));
    });

    test('handles Windows-style path', () => {
      const filePath = 'C:\\Users\\dev\\project\\file.ts';
      const item = createFileItem(filePath);

      assert.strictEqual(item.data.filePath, filePath);
    });

    test('handles relative path', () => {
      const filePath = './src/utils/helpers.ts';
      const item = createFileItem(filePath);

      assert.strictEqual(item.data.filePath, filePath);
    });

    test('handles path with special characters', () => {
      const filePath = '/path/to/@components/Button.tsx';
      const item = createFileItem(filePath);

      assert.strictEqual(item.data.filePath, filePath);
    });

    test('handles empty path', () => {
      const item = createFileItem('');

      assert.strictEqual(item.data.filePath, '');
    });

    test('handles root path', () => {
      const item = createFileItem('/');

      assert.strictEqual(item.data.filePath, '/');
    });

    test('handles deep nested path', () => {
      const filePath = '/very/deep/nested/path/to/some/file/in/project/file.ts';
      const item = createFileItem(filePath);

      assert.strictEqual(item.data.filePath, filePath);
      assert.ok(item.label.includes('file.ts'), `Label should include filename: ${item.label}`);
    });

    test('handles path with multiple extensions', () => {
      const filePath = '/path/to/file.test.spec.ts';
      const item = createFileItem(filePath);

      assert.strictEqual(item.data.filePath, filePath);
      assert.ok(
        item.label.includes('file.test.spec.ts'),
        `Label should include full filename: ${item.label}`,
      );
    });

    test('handles hidden file (dotfile)', () => {
      const filePath = '/path/to/.gitignore';
      const item = createFileItem(filePath);

      assert.strictEqual(item.data.filePath, filePath);
      assert.ok(item.label.includes('.gitignore'), `Label should include dotfile: ${item.label}`);
    });
  });

  suite('Item Comparison', () => {
    test('result items and file items have different types', () => {
      const resultItem = createResultItem({
        filePath: '/path/to/file.ts',
        linePos: 10,
        colPos: 1,
        textResult: 'test',
        rawResult: {
          type: 'match',
          data: {
            path: { text: '/path/to/file.ts' },
            lines: { text: 'test' },
            line_number: 10,
            absolute_offset: 0,
            submatches: [{ start: 0, end: 4, match: { text: 'test' } }],
          },
        },
      });

      const fileItem = createFileItem('/path/to/file.ts');

      assert.notStrictEqual(resultItem._type, fileItem._type);
      assert.strictEqual(resultItem._type, 'QuickPickItemQuery');
      assert.strictEqual(fileItem._type, 'QuickPickItemFile');
    });

    test('both item types have buttons', () => {
      const resultItem = createResultItem({
        filePath: '/path/to/file.ts',
        linePos: 10,
        colPos: 1,
        textResult: 'test',
        rawResult: {
          type: 'match',
          data: {
            path: { text: '/path/to/file.ts' },
            lines: { text: 'test' },
            line_number: 10,
            absolute_offset: 0,
            submatches: [{ start: 0, end: 4, match: { text: 'test' } }],
          },
        },
      });

      const fileItem = createFileItem('/path/to/file.ts');

      assert.ok(resultItem.buttons);
      assert.ok(fileItem.buttons);
      assert.strictEqual(resultItem.buttons!.length, 1);
      assert.strictEqual(fileItem.buttons!.length, 1);
    });

    test('both item types have alwaysShow set to true', () => {
      const resultItem = createResultItem({
        filePath: '/path/to/file.ts',
        linePos: 10,
        colPos: 1,
        textResult: 'test',
        rawResult: {
          type: 'match',
          data: {
            path: { text: '/path/to/file.ts' },
            lines: { text: 'test' },
            line_number: 10,
            absolute_offset: 0,
            submatches: [{ start: 0, end: 4, match: { text: 'test' } }],
          },
        },
      });

      const fileItem = createFileItem('/path/to/file.ts');

      assert.strictEqual(resultItem.alwaysShow, true);
      assert.strictEqual(fileItem.alwaysShow, true);
    });
  });
});
