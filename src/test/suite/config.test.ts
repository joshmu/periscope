import * as assert from 'assert';
import { getConfig } from '../../utils/getConfig';

suite('Configuration Tests', () => {
  test('should validate default settings', () => {
    const config = getConfig();

    // Theme-aware color settings should default to null
    assert.strictEqual(config.peekBorderColor, null, 'Default peekBorderColor should be null');
    assert.strictEqual(config.peekMatchColor, null, 'Default peekMatchColor should be null');
    assert.strictEqual(
      config.peekMatchBorderColor,
      null,
      'Default peekMatchBorderColor should be null',
    );

    // Border styles should have their defaults
    assert.strictEqual(config.peekBorderWidth, '2px', 'Default peekBorderWidth should be 2px');
    assert.strictEqual(config.peekBorderStyle, 'solid', 'Default peekBorderStyle should be solid');
    assert.strictEqual(
      config.peekMatchBorderWidth,
      '1px',
      'Default peekMatchBorderWidth should be 1px',
    );
    assert.strictEqual(
      config.peekMatchBorderStyle,
      'solid',
      'Default peekMatchBorderStyle should be solid',
    );

    // showLineNumbers should default to false
    assert.strictEqual(config.showLineNumbers, false, 'showLineNumbers should default to false');
  });

  // ... rest of the tests ...
});
