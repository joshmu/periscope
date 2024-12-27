import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as vscodeRipgrep from '@vscode/ripgrep';
import * as ripgrepPath from '../../utils/ripgrepPath';
import * as findRipgrepSystemPath from '../../utils/findRipgrepSystemPath';

suite('RipgrepPath Resolution', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('uses user-specified path when valid', () => {
    const mockUserSpecifiedPath = '/path/to/user/ripgrep';
    sandbox.stub(vscodeRipgrep, 'rgPath').value(mockUserSpecifiedPath);

    // Mock file system operations
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'accessSync').returns(undefined);
    sandbox.stub(findRipgrepSystemPath, 'findRipgrepSystemPath').returns(mockUserSpecifiedPath);

    // Test path resolution
    const resolvedPath = ripgrepPath.resolveRipgrepPath(mockUserSpecifiedPath);
    assert.strictEqual(
      resolvedPath,
      mockUserSpecifiedPath,
      'Should use user-specified path when valid',
    );
  });

  test('falls back to system PATH when user-specified path is invalid', () => {
    const mockInvalidUserSpecifiedPath = '/path/to/user/ripgrep';
    const mockSystemPath = '/path/to/system/ripgrep';

    // Mock file system operations
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'accessSync').callsFake((path) => {
      if (path !== mockSystemPath) {
        throw new Error('ENOENT');
      }
      return undefined;
    });
    sandbox.stub(findRipgrepSystemPath, 'findRipgrepSystemPath').returns(mockSystemPath);

    // Test path resolution
    const resolvedPath = ripgrepPath.resolveRipgrepPath(mockInvalidUserSpecifiedPath);
    assert.strictEqual(
      resolvedPath,
      mockSystemPath,
      'Should use system path when user path is invalid',
    );
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

    sandbox.stub(findRipgrepSystemPath, 'findRipgrepSystemPath').returns(null);

    // Test vscode ripgrep fallback
    const resolvedPath = ripgrepPath.resolveRipgrepPath();
    assert.strictEqual(resolvedPath, mockRgPath, 'Should use vscode ripgrep as fallback');
  });

  test('handles Windows platform correctly', () => {
    // Mock Windows platform
    sandbox.stub(process, 'platform').value('win32');

    // Mock the config
    const mockRgPath = 'C:\\Program Files\\ripgrep\\rg.exe';

    // Mock file system operations
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'accessSync').returns(undefined);
    sandbox.stub(findRipgrepSystemPath, 'findRipgrepSystemPath').returns(mockRgPath);

    // Test Windows path handling
    const resolvedPath = ripgrepPath.resolveRipgrepPath(mockRgPath);
    assert.strictEqual(
      resolvedPath,
      'C:\\Program Files\\ripgrep\\rg.exe',
      'Should handle Windows paths correctly',
    );
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

    sandbox.stub(findRipgrepSystemPath, 'findRipgrepSystemPath').returns(null);

    // Test empty path handling
    const resolvedPath = ripgrepPath.resolveRipgrepPath('   ');
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

    sandbox.stub(findRipgrepSystemPath, 'findRipgrepSystemPath').returns(null);

    // Test error handling
    try {
      ripgrepPath.resolveRipgrepPath();
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
});
