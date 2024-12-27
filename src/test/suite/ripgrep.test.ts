import * as assert from 'assert';
import * as sinon from 'sinon';
import { context as cx } from '../../lib/context';
import { checkAndExtractRgFlagsFromQuery } from '../../lib/ripgrep';

// Add dedicated test suite for checkAndExtractRgFlagsFromQuery
suite('checkAndExtractRgFlagsFromQuery', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    // Mock the config for each test
    sandbox.stub(cx, 'config').value({
      rgQueryParams: [
        {
          regex: '^(.+) -t ?(\\w+)$',
          param: '-t $1',
        },
        {
          regex: '^(.+) --type=(\\w+)$',
          param: '--type=$1',
        },
        {
          regex: '^(.+) -g ?"([^"]+)"$',
          param: '-g "$1"',
        },
      ],
    });
  });

  teardown(() => {
    sandbox.restore();
  });

  test('should handle simple type flag', () => {
    const { updatedQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery('myquery -t js');
    assert.strictEqual(updatedQuery, 'myquery');
    assert.deepStrictEqual(extraRgFlags, ['-t js']);
  });

  test('should handle long form type flag', () => {
    const { updatedQuery, extraRgFlags } =
      checkAndExtractRgFlagsFromQuery('searchtext --type=rust');
    assert.strictEqual(updatedQuery, 'searchtext');
    assert.deepStrictEqual(extraRgFlags, ['--type=rust']);
  });

  test('should handle glob pattern with quotes', () => {
    const { updatedQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery('findme -g "*.{js,ts}"');
    assert.strictEqual(updatedQuery, 'findme');
    assert.deepStrictEqual(extraRgFlags, ['-g "*.{js,ts}"']);
  });

  test('should return original query when no flags match', () => {
    const { updatedQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery('plain search query');
    assert.strictEqual(updatedQuery, 'plain search query');
    assert.deepStrictEqual(extraRgFlags, []);
  });

  test('should handle query with spaces', () => {
    const { updatedQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery(
      'search with spaces -t python',
    );
    assert.strictEqual(updatedQuery, 'search with spaces');
    assert.deepStrictEqual(extraRgFlags, ['-t python']);
  });
});
