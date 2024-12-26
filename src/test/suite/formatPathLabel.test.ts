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

  setup(() => {
    sandbox = sinon.createSandbox();

    // Mock getConfig
    getConfigStub = sandbox.stub();
    getConfigStub.returns({ ...defaultConfig });
    (global as GlobalWithConfig).getConfig = getConfigStub;

    // Mock workspace.workspaceFolders with default single workspace
    workspaceFoldersStub = sandbox.stub(vscode.workspace, 'workspaceFolders').get(
      () =>
        [
          {
            uri: vscode.Uri.file('/test/workspace'),
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
      const testPath = '/test/workspace/src/utils/file.ts';
      const expected = path.join('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles no workspace folder', () => {
      workspaceFoldersStub.get(() => undefined);
      const testPath = '/some/test/path/file.ts';
      assert.strictEqual(formatPathLabel(testPath), testPath);
    });

    test('handles workspace folder name toggle', () => {
      getConfigStub.returns({ ...defaultConfig, showWorkspaceFolderInFilePath: false });
      const testPath = '/test/workspace/src/utils/file.ts';
      const expected = path.join('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles file outside workspace folder', () => {
      const testPath = '/different/workspace/src/file.ts';
      const expected = path.join('workspace', '...', 'different', 'workspace', 'src', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles multiple workspace folders', () => {
      workspaceFoldersStub.get(
        () =>
          [
            {
              uri: vscode.Uri.file('/test/workspace'),
              name: 'workspace',
              index: 0,
            },
            {
              uri: vscode.Uri.file('/test/workspace2'),
              name: 'workspace2',
              index: 1,
            },
          ] as readonly vscode.WorkspaceFolder[],
      );

      const testPath = '/test/workspace2/src/file.ts';
      const expected = 'workspace/../workspace2/src/file.ts';
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });

  suite('Path Abbreviation', () => {
    test('abbreviates long paths according to config depths', () => {
      const testPath = '/test/workspace/src/deep/nested/folder/structure/file.ts';
      const expected = path.join('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('does not abbreviate paths within depth limits', () => {
      const testPath = '/test/workspace/src/utils/file.ts';
      const expected = path.join('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles custom start folder display depth', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayDepth: 3 });
      const testPath = '/test/workspace/src/deep/nested/folder/structure/file.ts';
      const expected = path.join('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles custom end folder display depth', () => {
      getConfigStub.returns({ ...defaultConfig, endFolderDisplayDepth: 2 });
      const testPath = '/test/workspace/src/deep/nested/folder/structure/file.ts';
      const expected = path.join('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles custom start folder display index', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayIndex: 1 });
      const testPath = '/test/workspace/src/deep/nested/folder/structure/file.ts';
      const expected = path.join('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });

  suite('Edge Cases', () => {
    test('handles empty path', () => {
      const expected = path.join('workspace', '...', 'code', 'projects', 'vscode-extensions', 'periscope');
      assert.strictEqual(formatPathLabel(''), expected);
    });

    test('handles path with no file name', () => {
      const testPath = '/test/workspace/src/utils/';
      const expected = path.join('workspace', 'src', 'utils');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles root path', () => {
      const expected = 'workspace/../..';
      assert.strictEqual(formatPathLabel('/'), expected);
    });

    test('handles path with special characters', () => {
      const testPath = '/test/workspace/src/@types/file.d.ts';
      const expected = path.join('workspace', 'src', '@types', 'file.d.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });

  suite('Config Edge Cases', () => {
    test('handles zero display depths', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayDepth: 0, endFolderDisplayDepth: 0 });
      const testPath = '/test/workspace/src/deep/nested/folder/structure/file.ts';
      const expected = path.join('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles display depths larger than path length', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayDepth: 10, endFolderDisplayDepth: 10 });
      const testPath = '/test/workspace/src/utils/file.ts';
      const expected = path.join('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles negative display depths', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayDepth: -1, endFolderDisplayDepth: -1 });
      const testPath = '/test/workspace/src/utils/file.ts';
      const expected = path.join('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles negative display index', () => {
      getConfigStub.returns({ ...defaultConfig, startFolderDisplayIndex: -1 });
      const testPath = '/test/workspace/src/deep/nested/folder/structure/file.ts';
      const expected = path.join('workspace', '...', 'nested', 'folder', 'structure', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });

  suite('Path Separator Edge Cases', () => {
    test('handles mixed path separators', () => {
      const testPath = '/test/workspace\\src\\utils/file.ts';
      const expected = 'workspace/../workspace\\src\\utils/file.ts';
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles consecutive path separators', () => {
      const testPath = '/test/workspace//src///utils////file.ts';
      const expected = path.join('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });

  suite('Complex Path Cases', () => {
    test('handles deeply nested paths with parent traversal', () => {
      const testPath = '/test/workspace/../../other/path/file.ts';
      const expected = 'workspace/.../../other/path/file.ts';
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles paths with unicode characters', () => {
      const testPath = '/test/workspace/src/🔍/测试/file.ts';
      const expected = path.join('workspace', 'src', '🔍', '测试', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });
});
