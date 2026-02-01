import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  handleSearchTermWithAdditionalRgParams,
  normaliseRgResult,
  ensureQuotedPath,
  checkAndExtractRgFlagsFromQuery,
} from '../../src/lib/ripgrep';
import { context as cx } from '../../src/lib/context';
import { RgMatchRawResult } from '../../src/types/ripgrep';

/* eslint-disable @typescript-eslint/naming-convention */
// Ripgrep JSON output uses snake_case for properties (line_number, absolute_offset)

suite('Ripgrep Utility Functions - Unit Tests', function () {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    cx.resetContext();
  });

  teardown(() => {
    sandbox.restore();
  });

  suite('handleSearchTermWithAdditionalRgParams', () => {
    test('wraps simple query in quotes', () => {
      const result = handleSearchTermWithAdditionalRgParams('hello');
      assert.strictEqual(result, '"hello"');
    });

    test('wraps query with spaces in quotes', () => {
      const result = handleSearchTermWithAdditionalRgParams('hello world');
      assert.strictEqual(result, '"hello world"');
    });

    test('preserves already quoted query', () => {
      const result = handleSearchTermWithAdditionalRgParams('"hello" -t js');
      assert.strictEqual(result, '"hello" -t js');
    });

    test('preserves quoted query with spaces', () => {
      const result = handleSearchTermWithAdditionalRgParams('"hello world" --max-count=5');
      assert.strictEqual(result, '"hello world" --max-count=5');
    });

    test('preserves complex quoted query with multiple params', () => {
      const result = handleSearchTermWithAdditionalRgParams('"test function" -g "*.test.ts" -i');
      assert.strictEqual(result, '"test function" -g "*.test.ts" -i');
    });

    test('wraps empty string in quotes', () => {
      const result = handleSearchTermWithAdditionalRgParams('');
      assert.strictEqual(result, '""');
    });

    test('wraps regex pattern in quotes', () => {
      const result = handleSearchTermWithAdditionalRgParams('function\\s+\\w+');
      assert.strictEqual(result, '"function\\s+\\w+"');
    });

    test('handles special characters that need quoting', () => {
      const result = handleSearchTermWithAdditionalRgParams('$HOME/path');
      assert.strictEqual(result, '"$HOME/path"');
    });

    test('handles single quotes in query (wraps in double quotes)', () => {
      const result = handleSearchTermWithAdditionalRgParams("it's a test");
      assert.strictEqual(result, '"it\'s a test"');
    });
  });

  suite('normaliseRgResult', () => {
    test('extracts basic match data', () => {
      const rawResult: RgMatchRawResult = {
        type: 'match',
        data: {
          path: { text: '/home/user/project/file.ts' },
          lines: { text: 'function test() { return true; }' },
          line_number: 10,
          absolute_offset: 100,
          submatches: [{ start: 0, end: 8, match: { text: 'function' } }],
        },
      };

      const result = normaliseRgResult(rawResult);

      assert.strictEqual(result.filePath, '/home/user/project/file.ts');
      assert.strictEqual(result.linePos, 10);
      assert.strictEqual(result.colPos, 1); // start (0) + 1
      assert.strictEqual(result.textResult, 'function test() { return true; }');
      assert.strictEqual(result.rawResult, rawResult);
    });

    test('calculates correct column position', () => {
      const rawResult: RgMatchRawResult = {
        type: 'match',
        data: {
          path: { text: '/file.ts' },
          lines: { text: '    const value = 123;' },
          line_number: 5,
          absolute_offset: 50,
          submatches: [{ start: 10, end: 15, match: { text: 'value' } }],
        },
      };

      const result = normaliseRgResult(rawResult);

      // Column is 1-indexed, so start (10) + 1 = 11
      assert.strictEqual(result.colPos, 11);
    });

    test('trims whitespace from text result', () => {
      const rawResult: RgMatchRawResult = {
        type: 'match',
        data: {
          path: { text: '/file.ts' },
          lines: { text: '   trimmed content   \n' },
          line_number: 1,
          absolute_offset: 0,
          submatches: [{ start: 3, end: 10, match: { text: 'trimmed' } }],
        },
      };

      const result = normaliseRgResult(rawResult);

      assert.strictEqual(result.textResult, 'trimmed content');
    });

    test('handles Windows-style paths', () => {
      const rawResult: RgMatchRawResult = {
        type: 'match',
        data: {
          path: { text: 'C:\\Users\\dev\\project\\file.ts' },
          lines: { text: 'export default {}' },
          line_number: 1,
          absolute_offset: 0,
          submatches: [{ start: 0, end: 6, match: { text: 'export' } }],
        },
      };

      const result = normaliseRgResult(rawResult);

      assert.strictEqual(result.filePath, 'C:\\Users\\dev\\project\\file.ts');
    });

    test('handles paths with spaces', () => {
      const rawResult: RgMatchRawResult = {
        type: 'match',
        data: {
          path: { text: '/home/user/my project/file with spaces.ts' },
          lines: { text: 'const x = 1;' },
          line_number: 1,
          absolute_offset: 0,
          submatches: [{ start: 0, end: 5, match: { text: 'const' } }],
        },
      };

      const result = normaliseRgResult(rawResult);

      assert.strictEqual(result.filePath, '/home/user/my project/file with spaces.ts');
    });

    test('handles unicode in file path and content', () => {
      const rawResult: RgMatchRawResult = {
        type: 'match',
        data: {
          path: { text: '/home/用户/项目/文件.ts' },
          lines: { text: 'const message = "你好世界";' },
          line_number: 1,
          absolute_offset: 0,
          submatches: [{ start: 0, end: 5, match: { text: 'const' } }],
        },
      };

      const result = normaliseRgResult(rawResult);

      assert.strictEqual(result.filePath, '/home/用户/项目/文件.ts');
      assert.strictEqual(result.textResult, 'const message = "你好世界";');
    });

    test('handles first submatch for column position', () => {
      const rawResult: RgMatchRawResult = {
        type: 'match',
        data: {
          path: { text: '/file.ts' },
          lines: { text: 'test test test' },
          line_number: 1,
          absolute_offset: 0,
          submatches: [
            { start: 0, end: 4, match: { text: 'test' } },
            { start: 5, end: 9, match: { text: 'test' } },
            { start: 10, end: 14, match: { text: 'test' } },
          ],
        },
      };

      const result = normaliseRgResult(rawResult);

      // Should use first submatch (start: 0)
      assert.strictEqual(result.colPos, 1);
    });
  });

  suite('ensureQuotedPath', () => {
    test('quotes simple path', () => {
      const result = ensureQuotedPath('/home/user/project');
      assert.strictEqual(result, '"/home/user/project"');
    });

    test('quotes path with spaces', () => {
      const result = ensureQuotedPath('/home/user/my project');
      assert.strictEqual(result, '"/home/user/my project"');
    });

    test('preserves already quoted path', () => {
      const result = ensureQuotedPath('"/home/user/project"');
      assert.strictEqual(result, '"/home/user/project"');
    });

    test('preserves already quoted path with spaces', () => {
      const result = ensureQuotedPath('"/home/user/my project"');
      assert.strictEqual(result, '"/home/user/my project"');
    });

    test('quotes Windows path', () => {
      const result = ensureQuotedPath('C:\\Users\\dev\\project');
      assert.strictEqual(result, '"C:\\Users\\dev\\project"');
    });

    test('quotes relative path', () => {
      const result = ensureQuotedPath('./src/utils');
      assert.strictEqual(result, '"./src/utils"');
    });

    test('quotes empty string', () => {
      const result = ensureQuotedPath('');
      assert.strictEqual(result, '""');
    });

    test('does not double-quote path with only opening quote', () => {
      const result = ensureQuotedPath('"/home/user/project');
      // This should quote the path since it doesn't end with quote
      assert.strictEqual(result, '""/home/user/project"');
    });

    test('does not double-quote path with only closing quote', () => {
      const result = ensureQuotedPath('/home/user/project"');
      // This should quote the path since it doesn't start with quote
      assert.strictEqual(result, '"/home/user/project""');
    });
  });

  suite('checkAndExtractRgFlagsFromQuery', () => {
    test('returns original query when no rgQueryParams configured', () => {
      cx.config = { ...cx.config, rgQueryParams: [] };

      const result = checkAndExtractRgFlagsFromQuery('hello world');

      assert.strictEqual(result.rgQuery, 'hello world');
      assert.deepStrictEqual(result.extraRgFlags, []);
    });

    test('extracts type filter with configured pattern', () => {
      cx.config = {
        ...cx.config,
        rgQueryParams: [
          {
            param: '-t $1',
            regex: '^(.+?)\\s+-t\\s+(\\w+)$',
          },
        ],
      };

      const result = checkAndExtractRgFlagsFromQuery('hello -t js');

      assert.strictEqual(result.rgQuery, 'hello');
      assert.deepStrictEqual(result.extraRgFlags, ['-t js']);
    });

    test('extracts glob pattern with configured pattern', () => {
      cx.config = {
        ...cx.config,
        rgQueryParams: [
          {
            param: '-g "$1"',
            regex: '^(.+?)\\s+(\\*\\.\\w+)$',
          },
        ],
      };

      const result = checkAndExtractRgFlagsFromQuery('search *.ts');

      assert.strictEqual(result.rgQuery, 'search');
      assert.deepStrictEqual(result.extraRgFlags, ['-g "*.ts"']);
    });

    test('handles multiple regex patterns', () => {
      cx.config = {
        ...cx.config,
        rgQueryParams: [
          {
            param: '-t $1',
            regex: '^(.+?)\\s+-t\\s+(\\w+)$',
          },
          {
            param: '-g "$1"',
            regex: '^(.+?)\\s+-g\\s+"([^"]+)"$',
          },
        ],
      };

      // Only the first matching pattern should extract
      const result = checkAndExtractRgFlagsFromQuery('hello -t js');

      assert.strictEqual(result.rgQuery, 'hello');
      assert.ok(result.extraRgFlags.includes('-t js'));
    });

    test('returns original query when pattern does not match', () => {
      cx.config = {
        ...cx.config,
        rgQueryParams: [
          {
            param: '-t $1',
            regex: '^(.+?)\\s+-t\\s+(\\w+)$',
          },
        ],
      };

      const result = checkAndExtractRgFlagsFromQuery('simple query');

      assert.strictEqual(result.rgQuery, 'simple query');
      assert.deepStrictEqual(result.extraRgFlags, []);
    });

    test('handles pattern with missing param', () => {
      cx.config = {
        ...cx.config,
        rgQueryParams: [
          {
            param: undefined as any,
            regex: '^(.+?)\\s+-t\\s+(\\w+)$',
          },
        ],
      };

      const result = checkAndExtractRgFlagsFromQuery('hello -t js');

      // Should skip patterns with missing param
      assert.strictEqual(result.rgQuery, 'hello -t js');
      assert.deepStrictEqual(result.extraRgFlags, []);
    });

    test('handles pattern with missing regex', () => {
      cx.config = {
        ...cx.config,
        rgQueryParams: [
          {
            param: '-t $1',
            regex: undefined as any,
          },
        ],
      };

      const result = checkAndExtractRgFlagsFromQuery('hello -t js');

      // Should skip patterns with missing regex
      assert.strictEqual(result.rgQuery, 'hello -t js');
      assert.deepStrictEqual(result.extraRgFlags, []);
    });

    test('handles module path shortcut pattern', () => {
      cx.config = {
        ...cx.config,
        rgQueryParams: [
          {
            param: '-g "**/$1/**"',
            regex: '^(.+?)\\s+-m\\s+([\\w-]+)$',
          },
        ],
      };

      const result = checkAndExtractRgFlagsFromQuery('redis -m auth');

      assert.strictEqual(result.rgQuery, 'redis');
      assert.deepStrictEqual(result.extraRgFlags, ['-g "**/auth/**"']);
    });

    test('handles empty query', () => {
      cx.config = {
        ...cx.config,
        rgQueryParams: [
          {
            param: '-t $1',
            regex: '^(.+?)\\s+-t\\s+(\\w+)$',
          },
        ],
      };

      const result = checkAndExtractRgFlagsFromQuery('');

      assert.strictEqual(result.rgQuery, '');
      assert.deepStrictEqual(result.extraRgFlags, []);
    });

    test('handles query with special regex characters', () => {
      cx.config = {
        ...cx.config,
        rgQueryParams: [
          {
            param: '-t $1',
            regex: '^(.+?)\\s+-t\\s+(\\w+)$',
          },
        ],
      };

      // Query contains regex special chars but doesn't match the pattern
      const result = checkAndExtractRgFlagsFromQuery('function.*test');

      assert.strictEqual(result.rgQuery, 'function.*test');
      assert.deepStrictEqual(result.extraRgFlags, []);
    });

    test('substitutes multiple capture groups', () => {
      cx.config = {
        ...cx.config,
        rgQueryParams: [
          {
            param: '-g "$1" -t $2',
            regex: '^(.+?)\\s+-f\\s+([\\w.]+)\\s+-t\\s+(\\w+)$',
          },
        ],
      };

      const result = checkAndExtractRgFlagsFromQuery('search -f *.test.ts -t js');

      assert.strictEqual(result.rgQuery, 'search');
      // $1 gets *.test.ts, $2 gets js
      assert.deepStrictEqual(result.extraRgFlags, ['-g "*.test.ts" -t js']);
    });
  });
});
