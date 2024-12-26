import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as vscodeRipgrep from '@vscode/ripgrep';
import * as childProcess from 'child_process';
import { execSync } from 'child_process';
import { context as cx } from '../../lib/context';
import { getConfig } from '../../utils/getConfig';
import { checkAndExtractRgFlagsFromQuery } from '../../lib/ripgrep';

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
    const mockConfig = {
      rgPath: '/custom/path/to/rg',
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => mockConfig[key as keyof typeof mockConfig],
    } as vscode.WorkspaceConfiguration);

    // Mock file system operations
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'accessSync').returns(undefined);

    // Get the config
    const config = getConfig();

    // Verify custom path is used
    assert.strictEqual(config.rgPath, '/custom/path/to/rg', 'Should use custom ripgrep path');
  });

  test('should construct command with options', () => {
    // Mock the config
    const mockConfig = {
      rgOptions: ['--case-sensitive', '--follow'],
      rgGlobExcludes: ['**/node_modules/**'],
      addSrcPaths: ['/custom/src'],
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => mockConfig[key as keyof typeof mockConfig],
    } as vscode.WorkspaceConfiguration);

    // Mock workspace folders
    sandbox.stub(vscode.workspace, 'workspaceFolders').value([
      {
        uri: vscode.Uri.file('/workspace/root'),
        name: 'workspace',
        index: 0,
      },
    ]);

    // Mock the context
    sandbox.stub(cx, 'rgMenuActionsSelected').value(['--type js']);

    // Get the config
    const config = getConfig();

    // Verify options are included
    assert.deepStrictEqual(config.rgOptions, ['--case-sensitive', '--follow'], 'Should include custom options');
    assert.deepStrictEqual(config.rgGlobExcludes, ['**/node_modules/**'], 'Should include glob excludes');
    assert.deepStrictEqual(config.addSrcPaths, ['/custom/src'], 'Should include additional source paths');
  });

  // Skipping this test as the glob pattern extraction needs to be fixed
  test.skip('should handle glob patterns', () => {
    // Mock the config
    const mockConfig = {
      rgQueryParams: [
        {
          regex: '^(.+) -t ?(\\w+)$',
          param: '-t $1',
        },
      ],
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => mockConfig[key as keyof typeof mockConfig],
    } as vscode.WorkspaceConfiguration);

    // Test query parameter extraction
    const { updatedQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery('search pattern -t js');
    assert.deepStrictEqual(extraRgFlags, ['-t js'], 'Should extract ripgrep flags');
    assert.strictEqual(updatedQuery, 'search pattern', 'Should extract base query');
  });

  test('should handle Windows platform correctly', () => {
    // Use a dedicated sandbox for platform testing
    const platformSandbox = sinon.createSandbox();

    try {
      // Mock Windows platform in isolated sandbox
      platformSandbox.stub(process, 'platform').value('win32');

      // Mock the config
      const mockConfig = {
        rgPath: 'C:\\Program Files\\ripgrep\\rg.exe',
      };
      platformSandbox.stub(vscode.workspace, 'getConfiguration').returns({
        get: (key: string) => mockConfig[key as keyof typeof mockConfig],
      } as vscode.WorkspaceConfiguration);

      // Mock file system operations
      platformSandbox.stub(fs, 'existsSync').returns(true);
      platformSandbox.stub(fs, 'accessSync').returns(undefined);

      // Get the config
      const config = getConfig();

      // Verify Windows path is handled correctly
      assert.strictEqual(config.rgPath, 'C:\\Program Files\\ripgrep\\rg.exe', 'Should handle Windows paths correctly');
    } finally {
      // Clean up platform sandbox
      platformSandbox.restore();
    }
  });

  test('uses user-specified path when valid', () => {
    // Mock the config with a valid path
    const mockRgPath = '/path/to/vscode/ripgrep';
    sandbox.stub(vscodeRipgrep, 'rgPath').value(mockRgPath);

    const mockConfig = {
      rgPath: mockRgPath,
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => mockConfig[key as keyof typeof mockConfig],
    } as vscode.WorkspaceConfiguration);

    // Mock file system operations
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'accessSync').returns(undefined);

    // Get the config
    const config = getConfig();

    // Verify the user-specified path is used
    assert.strictEqual(config.rgPath, mockRgPath, 'Should use user-specified path when valid');
  });

  test('falls back to system PATH when user path is invalid', () => {
    // Mock the config with an invalid path
    const mockRgPath = '/usr/local/bin/rg';

    const mockConfig = {
      rgPath: '/invalid/path/to/rg',
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => mockConfig[key as keyof typeof mockConfig],
    } as vscode.WorkspaceConfiguration);

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

    // Get the config
    const config = getConfig();

    // Verify fallback behavior
    assert.strictEqual(config.rgPath, mockRgPath, 'Should fall back to system PATH');
  });

  test('uses @vscode/ripgrep when no other options available', () => {
    // Mock the config with no path specified
    const mockRgPath = '/path/to/vscode/ripgrep';
    sandbox.stub(vscodeRipgrep, 'rgPath').value(mockRgPath);

    const mockConfig = {
      rgPath: undefined,
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => mockConfig[key as keyof typeof mockConfig],
    } as vscode.WorkspaceConfiguration);

    // Mock file system operations to fail for all paths except vscode ripgrep
    sandbox.stub(fs, 'existsSync').callsFake((path) => path === mockRgPath);
    sandbox.stub(fs, 'accessSync').callsFake((path) => {
      if (path !== mockRgPath) {
        throw new Error('ENOENT');
      }
    });

    // Mock execSync to fail
    sandbox.stub({ execSync }).execSync.throws(new Error('Command failed'));

    // Get the config
    const config = getConfig();

    // Verify vscode ripgrep is used
    assert.strictEqual(config.rgPath, mockRgPath, 'Should use vscode ripgrep as fallback');
  });

  test('handles empty or whitespace user path', () => {
    // Mock the config with whitespace path
    const mockRgPath = '/path/to/vscode/ripgrep';
    sandbox.stub(vscodeRipgrep, 'rgPath').value(mockRgPath);

    const mockConfig = {
      rgPath: '   ',
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => mockConfig[key as keyof typeof mockConfig],
    } as vscode.WorkspaceConfiguration);

    // Mock file system operations to fail for all paths except vscode ripgrep
    sandbox.stub(fs, 'existsSync').callsFake((path) => path === mockRgPath);
    sandbox.stub(fs, 'accessSync').callsFake((path) => {
      if (path !== mockRgPath) {
        throw new Error('ENOENT');
      }
    });

    // Mock execSync to fail
    sandbox.stub({ execSync }).execSync.throws(new Error('Command failed'));

    // Get the config
    const config = getConfig();

    // Verify empty path is handled by falling back to vscode ripgrep
    assert.strictEqual(config.rgPath, mockRgPath, 'Should handle empty path gracefully');
  });

  test('notifies error when ripgrep is not found anywhere', () => {
    // Mock VSCode window.showErrorMessage
    const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

    // Mock the config with no path
    sandbox.stub(vscodeRipgrep, 'rgPath').value(undefined);

    const mockConfig = {
      rgPath: undefined,
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => mockConfig[key as keyof typeof mockConfig],
    } as vscode.WorkspaceConfiguration);

    // Mock file system operations to fail
    sandbox.stub(fs, 'existsSync').returns(false);
    sandbox.stub(fs, 'accessSync').throws(new Error('ENOENT'));

    // Mock execSync to fail
    sandbox.stub({ execSync }).execSync.throws(new Error('Command failed'));

    // Get the config
    try {
      getConfig();
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
    const { updatedQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery('searchtext --type=rust');
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
    const { updatedQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery('search with spaces -t python');
    assert.strictEqual(updatedQuery, 'search with spaces');
    assert.deepStrictEqual(extraRgFlags, ['-t python']);
  });
});
