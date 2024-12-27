import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as vscodeRipgrep from '@vscode/ripgrep';
import * as childProcess from 'child_process';
import { execSync } from 'child_process';
import { context as cx } from '../../lib/context';
import { checkAndExtractRgFlagsFromQuery } from '../../lib/ripgrep';
import { resolveRipgrepPath } from '../../utils/ripgrepPath';

suite('Ripgrep Integration', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('should resolve ripgrep binary path', () => {
    // Mock the config
    const mockRgPath = '/custom/path/to/rg';
    sandbox.stub(vscodeRipgrep, 'rgPath').value(mockRgPath);

    // Mock file system operations
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'accessSync').returns(undefined);

    // Test direct path resolution
    const resolvedPath = resolveRipgrepPath('/custom/path/to/rg');
    assert.strictEqual(resolvedPath, '/custom/path/to/rg', 'Should resolve custom ripgrep path');
  });

  test('uses user-specified path when valid', () => {
    // Mock the config with a valid path
    const mockRgPath = '/path/to/vscode/ripgrep';
    sandbox.stub(vscodeRipgrep, 'rgPath').value(mockRgPath);

    // Mock file system operations
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'accessSync').returns(undefined);

    // Test path resolution
    const resolvedPath = resolveRipgrepPath(mockRgPath);
    assert.strictEqual(resolvedPath, mockRgPath, 'Should use user-specified path when valid');
  });

  test('falls back to system PATH when user path is invalid', () => {
    // Mock the config with an invalid path
    const mockRgPath = '/usr/local/bin/rg';

    // Mock file system operations
    const existsSyncStub = sandbox.stub(fs, 'existsSync');
    existsSyncStub.withArgs('/invalid/path/to/rg').returns(false);
    existsSyncStub.withArgs(mockRgPath).returns(true);

    // Mock access check
    const accessSyncStub = sandbox.stub(fs, 'accessSync');
    accessSyncStub.withArgs('/invalid/path/to/rg').throws(new Error('ENOENT'));
    accessSyncStub.withArgs(mockRgPath).returns(undefined);

    // Mock execSync for system PATH lookup
    sandbox.stub(childProcess, 'execSync').returns(Buffer.from(mockRgPath));

    // Mock process.platform
    sandbox.stub(process, 'platform').value('darwin');

    // Test fallback behavior
    const resolvedPath = resolveRipgrepPath('/invalid/path/to/rg');
    assert.strictEqual(resolvedPath, mockRgPath, 'Should fall back to system PATH');
  });

  test('uses @vscode/ripgrep when no other options available', () => {
    // Mock the config with no path specified
    const mockRgPath = '/path/to/vscode/ripgrep';
    sandbox.stub(vscodeRipgrep, 'rgPath').value(mockRgPath);

    // Mock file system operations to fail for all paths except vscode ripgrep
    sandbox.stub(fs, 'existsSync').callsFake((path) => path === mockRgPath);
    sandbox.stub(fs, 'accessSync').callsFake((path) => {
      if (path !== mockRgPath) {
        throw new Error('ENOENT');
      }
    });

    // Mock execSync to fail
    sandbox.stub({ execSync }).execSync.throws(new Error('Command failed'));

    // Test vscode ripgrep fallback
    const resolvedPath = resolveRipgrepPath();
    assert.strictEqual(resolvedPath, mockRgPath, 'Should use vscode ripgrep as fallback');
  });

  test('handles empty or whitespace user path', () => {
    // Mock the config with whitespace path
    const mockRgPath = '/path/to/vscode/ripgrep';
    sandbox.stub(vscodeRipgrep, 'rgPath').value(mockRgPath);

    // Mock file system operations to fail for all paths except vscode ripgrep
    sandbox.stub(fs, 'existsSync').callsFake((path) => path === mockRgPath);
    sandbox.stub(fs, 'accessSync').callsFake((path) => {
      if (path !== mockRgPath) {
        throw new Error('ENOENT');
      }
    });

    // Mock execSync to fail
    sandbox.stub({ execSync }).execSync.throws(new Error('Command failed'));

    // Test empty path handling
    const resolvedPath = resolveRipgrepPath('   ');
    assert.strictEqual(resolvedPath, mockRgPath, 'Should handle empty path gracefully');
  });

  test('notifies error when ripgrep is not found anywhere', () => {
    // Mock VSCode window.showErrorMessage
    const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

    // Mock the config with no path
    sandbox.stub(vscodeRipgrep, 'rgPath').value(undefined);

    // Mock file system operations to fail
    sandbox.stub(fs, 'existsSync').returns(false);
    sandbox.stub(fs, 'accessSync').throws(new Error('ENOENT'));

    // Mock execSync to fail
    sandbox.stub({ execSync }).execSync.throws(new Error('Command failed'));

    // Test error handling
    try {
      resolveRipgrepPath();
      assert.fail('Should throw error when ripgrep is not found');
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw error when ripgrep is not found');
      assert.strictEqual(error.message, 'Ripgrep not found', 'Should throw with correct message');
      assert.strictEqual(showErrorMessageStub.calledOnce, true, 'Should show error message');
      assert.strictEqual(
        showErrorMessageStub.firstCall.args[0],
        'PERISCOPE: Ripgrep not found. Please install ripgrep or configure a valid path.',
        'Should show correct error message',
      );
    }
  });

  test('handles Windows platform correctly', () => {
    // Use a dedicated sandbox for platform testing
    const platformSandbox = sinon.createSandbox();

    try {
      // Mock Windows platform in isolated sandbox
      platformSandbox.stub(process, 'platform').value('win32');

      // Mock the config
      const mockRgPath = 'C:\\Program Files\\ripgrep\\rg.exe';

      // Mock file system operations
      platformSandbox.stub(fs, 'existsSync').returns(true);
      platformSandbox.stub(fs, 'accessSync').returns(undefined);

      // Test Windows path handling
      const resolvedPath = resolveRipgrepPath(mockRgPath);
      assert.strictEqual(
        resolvedPath,
        'C:\\Program Files\\ripgrep\\rg.exe',
        'Should handle Windows paths correctly',
      );
    } finally {
      // Clean up platform sandbox
      platformSandbox.restore();
    }
  });
});

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
