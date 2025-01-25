import * as assert from 'assert';
import { getRgQueryParamsTitle } from '../../lib/quickpickActions';

suite('QuickPick Actions', () => {
  suite('getRgQueryParamsTitle', () => {
    test('should return undefined when no extra flags are provided', () => {
      const result = getRgQueryParamsTitle('search query', []);
      assert.strictEqual(result, undefined);
    });

    test('should format title with single flag', () => {
      const result = getRgQueryParamsTitle('search query', ['-i']);
      assert.strictEqual(result, `rg 'search query' -i`);
    });

    test('should format title with multiple flags', () => {
      const result = getRgQueryParamsTitle('search query', ['-i', '--type=ts']);
      assert.strictEqual(result, `rg 'search query' -i --type=ts`);
    });

    test('should handle empty query with flags', () => {
      const result = getRgQueryParamsTitle('', ['-i']);
      assert.strictEqual(result, `rg '' -i`);
    });

    test('should handle query with special characters', () => {
      const result = getRgQueryParamsTitle('query with "quotes"', ['-i']);
      assert.strictEqual(result, `rg 'query with "quotes"' -i`);
    });
  });
});
