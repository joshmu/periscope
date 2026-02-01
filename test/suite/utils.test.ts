import * as assert from 'assert';
import { tryJsonParse } from '../../src/utils/jsonUtils';

suite('Utility Functions - Unit Tests', function () {
  suite('jsonUtils - tryJsonParse', () => {
    test('parses valid JSON object', () => {
      const input = '{"name": "test", "value": 123}';
      const result = tryJsonParse<{ name: string; value: number }>(input);

      assert.ok(result !== undefined, 'Should parse valid JSON');
      assert.strictEqual(result?.name, 'test');
      assert.strictEqual(result?.value, 123);
    });

    test('parses valid JSON array', () => {
      const input = '[1, 2, 3, "four"]';
      const result = tryJsonParse<(number | string)[]>(input);

      assert.ok(result !== undefined, 'Should parse JSON array');
      assert.strictEqual(result?.length, 4);
      assert.strictEqual(result?.[3], 'four');
    });

    test('parses nested JSON', () => {
      const input = '{"outer": {"inner": {"deep": true}}}';
      const result = tryJsonParse<{ outer: { inner: { deep: boolean } } }>(input);

      assert.ok(result !== undefined, 'Should parse nested JSON');
      assert.strictEqual(result?.outer.inner.deep, true);
    });

    test('parses JSON with special characters', () => {
      const input = '{"path": "/home/user/file with spaces.ts", "text": "hello\\nworld"}';
      const result = tryJsonParse<{ path: string; text: string }>(input);

      assert.ok(result !== undefined, 'Should parse JSON with special chars');
      assert.strictEqual(result?.path, '/home/user/file with spaces.ts');
      assert.strictEqual(result?.text, 'hello\nworld');
    });

    test('returns undefined for invalid JSON', () => {
      const invalidInputs = [
        '{invalid}',
        '{"unclosed": ',
        'not json at all',
        '{key: "no quotes on key"}',
        "{'single': 'quotes'}",
      ];

      invalidInputs.forEach((input) => {
        const result = tryJsonParse(input);
        assert.strictEqual(result, undefined, `Should return undefined for: ${input}`);
      });
    });

    test('returns undefined for empty string', () => {
      const result = tryJsonParse('');
      assert.strictEqual(result, undefined, 'Should return undefined for empty string');
    });

    test('parses JSON primitives', () => {
      assert.strictEqual(tryJsonParse<number>('123'), 123);
      assert.strictEqual(tryJsonParse<string>('"hello"'), 'hello');
      assert.strictEqual(tryJsonParse<boolean>('true'), true);
      assert.strictEqual(tryJsonParse<boolean>('false'), false);
      assert.strictEqual(tryJsonParse<null>('null'), null);
    });

    test('parses ripgrep match result format', () => {
      /* eslint-disable @typescript-eslint/naming-convention */
      const rgOutput = JSON.stringify({
        type: 'match',
        data: {
          path: { text: '/home/user/file.ts' },
          lines: { text: 'function test() {}' },
          line_number: 10,
          absolute_offset: 100,
          submatches: [{ start: 0, end: 8, match: { text: 'function' } }],
        },
      });

      const result = tryJsonParse<{
        type: string;
        data: {
          path: { text: string };
          lines: { text: string };
          line_number: number;
        };
      }>(rgOutput);
      /* eslint-enable @typescript-eslint/naming-convention */

      assert.ok(result !== undefined, 'Should parse ripgrep output');
      assert.strictEqual(result?.type, 'match');
      assert.strictEqual(result?.data.path.text, '/home/user/file.ts');
      assert.strictEqual(result?.data.line_number, 10);
    });
  });
});
