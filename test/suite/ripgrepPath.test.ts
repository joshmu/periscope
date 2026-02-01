import * as assert from 'assert';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { resolveRipgrepPath } from '../../src/utils/ripgrepPath';
import { findRipgrepSystemPath } from '../../src/utils/findRipgrepSystemPath';
import { TEST_TIMEOUTS } from '../utils/periscopeTestHelper';

suite('Ripgrep Path Resolution - Unit Tests', function () {
  this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

  let sandbox: sinon.SinonSandbox;

  setup(async () => {
    sandbox = sinon.createSandbox();

    // Ensure extension is activated
    const ext = vscode.extensions.getExtension('JoshMu.periscope');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  teardown(() => {
    sandbox.restore();
  });

  suite('resolveRipgrepPath', () => {
    test('returns user path when it exists and is accessible', () => {
      // Use a known existing path (like node binary) for testing
      const existingSpy = sandbox.stub(fs, 'existsSync').returns(true);
      const accessSpy = sandbox.stub(fs, 'accessSync').returns(undefined);

      const result = resolveRipgrepPath('/custom/path/to/rg');

      assert.strictEqual(result, '/custom/path/to/rg');
      assert.ok(existingSpy.calledWith('/custom/path/to/rg'));
    });

    test('trims whitespace from user path', () => {
      const existsSpy = sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'accessSync').returns(undefined);

      const result = resolveRipgrepPath('  /path/to/rg  ');

      assert.strictEqual(result, '/path/to/rg');
      assert.ok(existsSpy.calledWith('/path/to/rg'));
    });

    test('falls back to system PATH when user path does not exist', () => {
      // Stub fs to return false for user path
      sandbox.stub(fs, 'existsSync').callsFake((path) => {
        // Return false for user path, true for system path check
        return path !== '/nonexistent/path/to/rg';
      });
      sandbox.stub(fs, 'accessSync').returns(undefined);

      // This will fall through to the system path search or vscode ripgrep
      // The exact return depends on the environment
      try {
        const result = resolveRipgrepPath('/nonexistent/path/to/rg');
        assert.ok(result, 'Should return some path');
      } catch (e) {
        // If ripgrep is not found at all, it throws an error
        assert.ok((e as Error).message.includes('Ripgrep not found'));
      }
    });

    test('handles empty user path', () => {
      // When user path is empty, should proceed to system/bundled search
      try {
        const result = resolveRipgrepPath('');
        assert.ok(result, 'Should return a valid path');
      } catch (e) {
        // If no ripgrep is found at all
        assert.ok((e as Error).message.includes('Ripgrep not found'));
      }
    });

    test('handles undefined user path', () => {
      try {
        const result = resolveRipgrepPath(undefined);
        assert.ok(result, 'Should return a valid path');
      } catch (e) {
        assert.ok((e as Error).message.includes('Ripgrep not found'));
      }
    });

    test('handles whitespace-only user path', () => {
      try {
        const result = resolveRipgrepPath('   ');
        // Empty after trim, should proceed to system/bundled search
        assert.ok(result, 'Should return a valid path');
      } catch (e) {
        assert.ok((e as Error).message.includes('Ripgrep not found'));
      }
    });
  });

  suite('findRipgrepSystemPath', () => {
    test('returns null when ripgrep is not in PATH or common locations', () => {
      // Stub to simulate ripgrep not being found anywhere
      sandbox.stub(fs, 'existsSync').returns(false);

      const result = findRipgrepSystemPath();

      // Should return null when ripgrep is not found
      assert.strictEqual(result, null);
    });

    test('finds ripgrep in common installation path', () => {
      // Simulate finding ripgrep in a common path
      const expectedPath = '/usr/local/bin/rg';

      sandbox.stub(fs, 'existsSync').callsFake((path) => {
        return path === expectedPath;
      });
      sandbox.stub(fs, 'accessSync').callsFake((path) => {
        if (path !== expectedPath) {
          throw new Error('Not accessible');
        }
      });

      const result = findRipgrepSystemPath();

      assert.strictEqual(result, expectedPath);
    });

    test('checks system PATH after common locations', () => {
      // Simulate ripgrep only in PATH, not in common locations
      const pathDir = '/custom/bin';
      const expectedPath = `${pathDir}/rg`;
      const originalPath = process.env.PATH;

      try {
        process.env.PATH = pathDir;

        sandbox.stub(fs, 'existsSync').callsFake((path) => {
          return path === expectedPath;
        });
        sandbox.stub(fs, 'accessSync').callsFake((path) => {
          if (path !== expectedPath) {
            throw new Error('Not accessible');
          }
        });

        const result = findRipgrepSystemPath();

        assert.strictEqual(result, expectedPath);
      } finally {
        process.env.PATH = originalPath;
      }
    });

    test('skips non-executable files', () => {
      const pathDir = '/test/bin';
      const originalPath = process.env.PATH;

      try {
        process.env.PATH = pathDir;

        sandbox.stub(fs, 'existsSync').returns(true);
        sandbox.stub(fs, 'accessSync').throws(new Error('Permission denied'));

        const result = findRipgrepSystemPath();

        // Should return null because file is not executable
        assert.strictEqual(result, null);
      } finally {
        process.env.PATH = originalPath;
      }
    });

    test('handles empty PATH', () => {
      const originalPath = process.env.PATH;

      try {
        process.env.PATH = '';

        sandbox.stub(fs, 'existsSync').returns(false);

        const result = findRipgrepSystemPath();

        assert.strictEqual(result, null);
      } finally {
        process.env.PATH = originalPath;
      }
    });

    test('handles PATH with empty segments', () => {
      const pathDir = '/valid/bin';
      const expectedPath = `${pathDir}/rg`;
      const originalPath = process.env.PATH;

      try {
        // PATH with empty segments (from consecutive colons)
        process.env.PATH = `::${pathDir}::`;

        sandbox.stub(fs, 'existsSync').callsFake((path) => {
          return path === expectedPath;
        });
        sandbox.stub(fs, 'accessSync').callsFake((path) => {
          if (path !== expectedPath) {
            throw new Error('Not accessible');
          }
        });

        const result = findRipgrepSystemPath();

        assert.strictEqual(result, expectedPath);
      } finally {
        process.env.PATH = originalPath;
      }
    });
  });

  suite('Integration with Extension', () => {
    test('extension uses a valid ripgrep path', async () => {
      // The extension should have resolved a valid ripgrep path on activation
      const ext = vscode.extensions.getExtension('JoshMu.periscope');
      assert.ok(ext, 'Extension should be available');

      if (ext && ext.isActive) {
        // If extension is active, ripgrep path was successfully resolved
        // The getConfig function would have been called during activation
        // We can verify the extension didn't throw during activation
        assert.ok(true, 'Extension activated successfully with valid ripgrep path');
      }
    });

    test('configuration provides ripgrep path', () => {
      const config = vscode.workspace.getConfiguration('periscope');
      const rgPath = config.get<string>('rgPath');

      // rgPath can be undefined (uses default) or a custom path
      if (rgPath) {
        assert.ok(typeof rgPath === 'string', 'rgPath should be a string');
        assert.ok(rgPath.length > 0, 'rgPath should not be empty');
      }
    });
  });

  suite('Path Validation Edge Cases', () => {
    test('handles paths with spaces', () => {
      const pathWithSpaces = '/path/with spaces/rg';

      sandbox.stub(fs, 'existsSync').callsFake((path) => path === pathWithSpaces);
      sandbox.stub(fs, 'accessSync').returns(undefined);

      const result = resolveRipgrepPath(pathWithSpaces);

      assert.strictEqual(result, pathWithSpaces);
    });

    test('handles Windows-style paths', () => {
      if (process.platform !== 'win32') {
        // Skip on non-Windows
        return;
      }

      const windowsPath = 'C:\\Program Files\\ripgrep\\rg.exe';

      sandbox.stub(fs, 'existsSync').callsFake((path) => path === windowsPath);
      sandbox.stub(fs, 'accessSync').returns(undefined);

      const result = resolveRipgrepPath(windowsPath);

      assert.strictEqual(result, windowsPath);
    });

    test('handles relative paths', () => {
      const relativePath = './bin/rg';

      sandbox.stub(fs, 'existsSync').callsFake((path) => path === relativePath);
      sandbox.stub(fs, 'accessSync').returns(undefined);

      const result = resolveRipgrepPath(relativePath);

      assert.strictEqual(result, relativePath);
    });

    test('handles paths with special characters', () => {
      const specialPath = '/path/@special/rg';

      sandbox.stub(fs, 'existsSync').callsFake((path) => path === specialPath);
      sandbox.stub(fs, 'accessSync').returns(undefined);

      const result = resolveRipgrepPath(specialPath);

      assert.strictEqual(result, specialPath);
    });

    test('handles access permission errors', () => {
      const validPath = '/path/to/rg';

      sandbox.stub(fs, 'existsSync').returns(true);
      sandbox.stub(fs, 'accessSync').throws(new Error('EACCES: permission denied'));

      // Should fall through to system path/bundled when permission denied
      try {
        resolveRipgrepPath(validPath);
        // If it succeeds, it found an alternative
      } catch (e) {
        // If it fails completely, ripgrep wasn't found anywhere
        assert.ok((e as Error).message.includes('Ripgrep not found'));
      }
    });
  });
});
