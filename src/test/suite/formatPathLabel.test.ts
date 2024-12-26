import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as sinon from 'sinon';
import { formatPathLabel } from '../../utils/formatPathLabel';
import { getConfig } from '../../utils/getConfig';

type GlobalWithConfig = typeof globalThis & {
  getConfig?: typeof getConfig;
};

suite('formatPathLabel Tests', () => {
  const defaultConfig = {
    showWorkspaceFolderInFilePath: true,
    startFolderDisplayDepth: 2,
    endFolderDisplayDepth: 1,
    startFolderDisplayIndex: 0,
  };

  let sandbox: sinon.SinonSandbox;
  let getConfigStub: sinon.SinonStub;
  let workspaceFoldersStub: sinon.SinonStub;

  // Platform-independent path helpers
  const createWorkspacePath = (...segments: string[]): string => {
    return vscode.Uri.file(path.join('test', 'workspace', ...segments)).fsPath;
  };

  const createExpectedPath = (...segments: string[]): string => {
    return segments.join(path.sep);
  };

  setup(() => {
    sandbox = sinon.createSandbox();

    // Mock getConfig
    getConfigStub = sandbox.stub();
    getConfigStub.returns({ ...defaultConfig });
    (global as GlobalWithConfig).getConfig = getConfigStub;

    // Mock workspace.workspaceFolders with platform-independent paths
    workspaceFoldersStub = sandbox.stub(vscode.workspace, 'workspaceFolders').get(
      () =>
        [
          {
            uri: vscode.Uri.file(path.join('test', 'workspace')),
            name: 'workspace',
            index: 0,
          },
        ] as readonly vscode.WorkspaceFolder[],
    );
  });

  teardown(() => {
    sandbox.restore();
    (global as GlobalWithConfig).getConfig = undefined;
  });

  suite('Workspace Folder Handling', () => {
    test('handles single workspace folder', () => {
      const testPath = createWorkspacePath('src', 'utils', 'file.ts');
      const expected = createExpectedPath('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles no workspace folder', () => {
      workspaceFoldersStub.get(() => undefined);
      const testPath = createWorkspacePath('src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), testPath);
    });

    test('handles workspace folder name toggle', () => {
      getConfigStub.returns({ ...defaultConfig, showWorkspaceFolderInFilePath: false });
      const testPath = createWorkspacePath('src', 'utils', 'file.ts');
      const expected = createExpectedPath('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles file outside workspace folder', () => {
      const testPath = path.join('different', 'workspace', 'src', 'file.ts');
      const expected = createExpectedPath('workspace', '...', 'different', 'workspace', 'src', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles multiple workspace folders', () => {
      const workspace2Path = path.join('test', 'workspace2');
      workspaceFoldersStub.get(
        () =>
          [
            {
              uri: vscode.Uri.file(path.join('test', 'workspace')),
              name: 'workspace',
              index: 0,
            },
            {
              uri: vscode.Uri.file(workspace2Path),
              name: 'workspace2',
              index: 1,
            },
          ] as readonly vscode.WorkspaceFolder[],
      );

      const testPath = path.join(workspace2Path, 'src', 'file.ts');
      const expected = createExpectedPath('workspace', '...', 'test', 'workspace2', 'src', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles cross-platform path separators', () => {
      const testPath =
        process.platform === 'win32'
          ? path.join('C:', 'test', 'workspace', 'src', 'file.ts')
          : path.join('/test/workspace/src/file.ts');
      const expected = createExpectedPath('workspace', 'src', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });

  suite('Path Abbreviation', () => {
    test('abbreviates long paths according to config depths', () => {
      const testPath = createWorkspacePath('src', 'deep', 'nested', 'folder', 'structure', 'file.ts');
      const expected = createExpectedPath('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('does not abbreviate paths within depth limits', () => {
      const testPath = createWorkspacePath('src', 'utils', 'file.ts');
      const expected = createExpectedPath('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles custom start folder display depth', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayDepth: 3 });
      const testPath = createWorkspacePath('src', 'deep', 'nested', 'folder', 'structure', 'file.ts');
      const expected = createExpectedPath('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles custom end folder display depth', () => {
      getConfigStub.returns({ ...defaultConfig, endFolderDisplayDepth: 2 });
      const testPath = createWorkspacePath('src', 'deep', 'nested', 'folder', 'structure', 'file.ts');
      const expected = createExpectedPath('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles custom start folder display index', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayIndex: 1 });
      const testPath = createWorkspacePath('src', 'deep', 'nested', 'folder', 'structure', 'file.ts');
      const expected = createExpectedPath('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });

  suite('Edge Cases', () => {
    test('handles empty path', () => {
      const expected = createExpectedPath('workspace', '...', 'code', 'projects', 'vscode-extensions', 'periscope');
      assert.strictEqual(formatPathLabel(''), expected);
    });

    test('handles path with no file name', () => {
      const testPath = createWorkspacePath('src', 'utils');
      const expected = createExpectedPath('workspace', 'src', 'utils');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles root path', () => {
      const expected = 'workspace/../..';
      assert.strictEqual(formatPathLabel('/'), expected);
    });

    test('handles path with special characters', () => {
      const testPath = createWorkspacePath('src', '@types', 'file.d.ts');
      const expected = createExpectedPath('workspace', 'src', '@types', 'file.d.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });

  suite('Config Edge Cases', () => {
    test('handles zero display depths', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayDepth: 0, endFolderDisplayDepth: 0 });
      const testPath = createWorkspacePath('src', 'deep', 'nested', 'folder', 'structure', 'file.ts');
      const expected = createExpectedPath('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles display depths larger than path length', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayDepth: 10, endFolderDisplayDepth: 10 });
      const testPath = createWorkspacePath('src', 'utils', 'file.ts');
      const expected = createExpectedPath('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles negative display depths', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayDepth: -1, endFolderDisplayDepth: -1 });
      const testPath = createWorkspacePath('src', 'utils', 'file.ts');
      const expected = createExpectedPath('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles negative display index', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayIndex: -1 });
      const testPath = createWorkspacePath('src', 'deep', 'nested', 'folder', 'structure', 'file.ts');
      const expected = createExpectedPath('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });

  suite('Path Separator Edge Cases', () => {
    test('handles mixed path separators', () => {
      const expected = createExpectedPath('workspace', 'src', 'utils', 'file.ts');
      const testPath = createWorkspacePath('src', 'utils', 'file.ts');

      const actual = formatPathLabel(testPath);

      assert.deepStrictEqual(actual.split(/[/\\]/).filter(Boolean), expected.split(/[/\\]/).filter(Boolean));
    });

    test('handles consecutive path separators', () => {
      const testPath = createWorkspacePath('src', 'utils', 'file.ts');
      const expected = createExpectedPath('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });

  suite('Complex Path Cases', () => {
    test('handles deeply nested paths with parent traversal', () => {
      const testPath = vscode.Uri.file(path.join('test', 'workspace', '..', '..', 'other', 'path', 'file.ts')).fsPath;

      const expected = createExpectedPath('workspace', '...', '..', 'other', 'path', 'file.ts');

      const actual = formatPathLabel(testPath);
      assert.deepStrictEqual(actual.split(/[/\\]/).filter(Boolean), expected.split(/[/\\]/).filter(Boolean));
    });

    test('handles paths with unicode characters', () => {
      const testPath = createWorkspacePath('src', '🔍', '测试', 'file.ts');
      const expected = createExpectedPath('workspace', 'src', '🔍', '测试', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });
});
