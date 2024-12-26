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
    test('returns original path when no workspace folders exist', () => {
      workspaceFoldersStub.get(() => undefined);
      const testPath = '/some/test/path/file.ts';
      assert.strictEqual(formatPathLabel(testPath), testPath);
    });

    test('includes workspace folder name when showWorkspaceFolderInFilePath is true', () => {
      const testPath = '/test/workspace/src/utils/file.ts';
      const expected = path.join('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('excludes workspace folder name when showWorkspaceFolderInFilePath is false', () => {
      getConfigStub.returns({ ...defaultConfig, showWorkspaceFolderInFilePath: false });
      const testPath = '/test/workspace/src/utils/file.ts';
      const expected = path.join('workspace', 'src', 'utils', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles paths outside workspace folder by using first workspace as fallback', () => {
      const testPath = '/different/workspace/src/file.ts';
      const expected = path.join('workspace', '...', 'different', 'workspace', 'src', 'file.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });

    test('handles multiple workspace folders by using correct workspace', () => {
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

    test.skip('handles root path', () => {
      const expected = '..';
      assert.strictEqual(formatPathLabel('/'), expected);
    });

    test('handles path with special characters', () => {
      const testPath = '/test/workspace/src/@types/file.d.ts';
      const expected = path.join('workspace', 'src', '@types', 'file.d.ts');
      assert.strictEqual(formatPathLabel(testPath), expected);
    });
  });
});
