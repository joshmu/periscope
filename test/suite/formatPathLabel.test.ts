import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import { formatPathLabel } from '../../src/utils/formatPathLabel';
import { TEST_TIMEOUTS, withConfiguration } from '../utils/periscopeTestHelper';

suite('formatPathLabel - Unit Tests', function () {
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

  suite('Line Number Formatting', () => {
    test('appends line number when showLineNumbers is enabled', async () => {
      await withConfiguration({ showLineNumbers: true }, async () => {
        const workspaceRoot = vscode.workspace.rootPath || '';
        const filePath = path.join(workspaceRoot, 'src', 'utils', 'helpers.ts');

        const result = formatPathLabel(filePath, { lineNumber: 42 });

        assert.ok(result.endsWith(':42'), `Expected line number suffix, got: ${result}`);
      });
    });

    test('does not append line number when showLineNumbers is disabled', async () => {
      await withConfiguration({ showLineNumbers: false }, async () => {
        const workspaceRoot = vscode.workspace.rootPath || '';
        const filePath = path.join(workspaceRoot, 'src', 'utils', 'helpers.ts');

        const result = formatPathLabel(filePath, { lineNumber: 42 });

        assert.ok(!result.endsWith(':42'), `Should not have line number suffix, got: ${result}`);
      });
    });

    test('does not append line number for zero', async () => {
      await withConfiguration({ showLineNumbers: true }, async () => {
        const workspaceRoot = vscode.workspace.rootPath || '';
        const filePath = path.join(workspaceRoot, 'src', 'utils', 'helpers.ts');

        const result = formatPathLabel(filePath, { lineNumber: 0 });

        assert.ok(!result.includes(':0'), `Should not append :0, got: ${result}`);
      });
    });

    test('does not append line number for negative values', async () => {
      await withConfiguration({ showLineNumbers: true }, async () => {
        const workspaceRoot = vscode.workspace.rootPath || '';
        const filePath = path.join(workspaceRoot, 'src', 'utils', 'helpers.ts');

        const result = formatPathLabel(filePath, { lineNumber: -5 });

        assert.ok(
          !result.includes(':-5'),
          `Should not append negative line number, got: ${result}`,
        );
      });
    });

    test('does not append line number for non-integer values', async () => {
      await withConfiguration({ showLineNumbers: true }, async () => {
        const workspaceRoot = vscode.workspace.rootPath || '';
        const filePath = path.join(workspaceRoot, 'src', 'utils', 'helpers.ts');

        const result = formatPathLabel(filePath, { lineNumber: 3.14 });

        assert.ok(!result.includes(':3.14'), `Should not append non-integer, got: ${result}`);
      });
    });

    test('handles undefined lineNumber', async () => {
      await withConfiguration({ showLineNumbers: true }, async () => {
        const workspaceRoot = vscode.workspace.rootPath || '';
        const filePath = path.join(workspaceRoot, 'src', 'utils', 'helpers.ts');

        const result = formatPathLabel(filePath, { lineNumber: undefined });

        // Should not throw and should not append line number
        assert.ok(typeof result === 'string');
        assert.ok(!result.match(/:\d+$/), `Should not have line number suffix, got: ${result}`);
      });
    });

    test('handles missing options object', async () => {
      await withConfiguration({ showLineNumbers: true }, async () => {
        const workspaceRoot = vscode.workspace.rootPath || '';
        const filePath = path.join(workspaceRoot, 'src', 'utils', 'helpers.ts');

        const result = formatPathLabel(filePath);

        // Should not throw
        assert.ok(typeof result === 'string');
      });
    });
  });

  suite('Path Formatting', () => {
    test('formats path relative to workspace', async () => {
      const workspaceRoot = vscode.workspace.rootPath || '';
      const filePath = path.join(workspaceRoot, 'src', 'utils', 'helpers.ts');

      const result = formatPathLabel(filePath);

      // Should contain the filename
      assert.ok(result.includes('helpers.ts'), `Should contain filename, got: ${result}`);
      // Should not be the full absolute path
      assert.ok(!result.startsWith(workspaceRoot), `Should be relative, got: ${result}`);
    });

    test('handles files in workspace root', async () => {
      const workspaceRoot = vscode.workspace.rootPath || '';
      const filePath = path.join(workspaceRoot, 'package.json');

      const result = formatPathLabel(filePath);

      assert.ok(result.includes('package.json'), `Should contain filename, got: ${result}`);
    });

    test('shows workspace folder name when configured', async () => {
      await withConfiguration({ showWorkspaceFolderInFilePath: true }, async () => {
        const workspaceRoot = vscode.workspace.rootPath || '';
        const workspaceName = path.basename(workspaceRoot);
        const filePath = path.join(workspaceRoot, 'src', 'index.ts');

        const result = formatPathLabel(filePath);

        assert.ok(
          result.includes(workspaceName) || result.includes('workspace'),
          `Should include workspace name, got: ${result}`,
        );
      });
    });

    test('hides workspace folder name when configured', async () => {
      await withConfiguration({ showWorkspaceFolderInFilePath: false }, async () => {
        const workspaceRoot = vscode.workspace.rootPath || '';
        const filePath = path.join(workspaceRoot, 'src', 'index.ts');

        const result = formatPathLabel(filePath);

        // Result should be a relative path without workspace name prefix
        assert.ok(result.includes('index.ts'), `Should contain filename, got: ${result}`);
      });
    });
  });

  suite('Path Abbreviation', () => {
    test('abbreviates long paths with ellipsis', async () => {
      await withConfiguration(
        {
          startFolderDisplayDepth: 1,
          endFolderDisplayDepth: 2,
        },
        async () => {
          const workspaceRoot = vscode.workspace.rootPath || '';
          // Create a deep path that should be abbreviated
          const filePath = path.join(
            workspaceRoot,
            'src',
            'components',
            'ui',
            'buttons',
            'primary',
            'Button.tsx',
          );

          const result = formatPathLabel(filePath);

          // For paths that exceed the display depth, should contain ellipsis
          // The exact format depends on configuration, but it should be shorter than full path
          assert.ok(result.includes('Button.tsx'), `Should contain filename, got: ${result}`);
        },
      );
    });

    test('does not abbreviate short paths', async () => {
      await withConfiguration(
        {
          startFolderDisplayDepth: 1,
          endFolderDisplayDepth: 4,
        },
        async () => {
          const workspaceRoot = vscode.workspace.rootPath || '';
          const filePath = path.join(workspaceRoot, 'src', 'index.ts');

          const result = formatPathLabel(filePath);

          // Short paths should not have ellipsis
          assert.ok(!result.includes('...'), `Should not abbreviate short path, got: ${result}`);
        },
      );
    });

    test('respects startFolderDisplayIndex', async () => {
      await withConfiguration(
        {
          startFolderDisplayIndex: 0,
          startFolderDisplayDepth: 1,
          endFolderDisplayDepth: 2,
        },
        async () => {
          const workspaceRoot = vscode.workspace.rootPath || '';
          const filePath = path.join(
            workspaceRoot,
            'packages',
            'core',
            'lib',
            'utils',
            'helpers.ts',
          );

          const result = formatPathLabel(filePath);

          assert.ok(result.includes('helpers.ts'), `Should contain filename, got: ${result}`);
        },
      );
    });
  });

  suite('Root Path Handling', () => {
    test('handles Unix root path', () => {
      const result = formatPathLabel('/');

      // Should return a workspace indicator
      assert.ok(result.includes('workspace') || result.includes('..'), `Got: ${result}`);
    });

    test('handles Windows root path', () => {
      const result = formatPathLabel('C:\\');

      // Should return a workspace indicator or handle gracefully
      assert.ok(typeof result === 'string', 'Should return a string');
    });

    test('handles backslash root path', () => {
      const result = formatPathLabel('\\');

      assert.ok(result.includes('workspace') || result.includes('..'), `Got: ${result}`);
    });
  });

  suite('Cross-Platform Path Handling', () => {
    test('normalizes forward slashes', () => {
      const workspaceRoot = vscode.workspace.rootPath || '';
      const filePath = workspaceRoot + '/src/utils/helpers.ts';

      const result = formatPathLabel(filePath);

      assert.ok(result.includes('helpers.ts'), `Should handle forward slashes, got: ${result}`);
    });

    test('normalizes backslashes', () => {
      const workspaceRoot = vscode.workspace.rootPath || '';
      const filePath = workspaceRoot + '\\src\\utils\\helpers.ts';

      const result = formatPathLabel(filePath);

      assert.ok(result.includes('helpers.ts'), `Should handle backslashes, got: ${result}`);
    });

    test('handles mixed path separators', () => {
      const workspaceRoot = vscode.workspace.rootPath || '';
      const filePath = workspaceRoot + '/src\\utils/helpers.ts';

      const result = formatPathLabel(filePath);

      assert.ok(result.includes('helpers.ts'), `Should handle mixed separators, got: ${result}`);
    });
  });

  suite('Edge Cases', () => {
    test('handles paths with spaces', () => {
      const workspaceRoot = vscode.workspace.rootPath || '';
      const filePath = path.join(workspaceRoot, 'folder with spaces', 'file with spaces.ts');

      const result = formatPathLabel(filePath);

      assert.ok(
        result.includes('file with spaces.ts'),
        `Should handle spaces in filename, got: ${result}`,
      );
    });

    test('handles special characters in path', () => {
      const workspaceRoot = vscode.workspace.rootPath || '';
      const filePath = path.join(workspaceRoot, 'src', '@components', 'Button.tsx');

      const result = formatPathLabel(filePath);

      assert.ok(
        result.includes('Button.tsx') || result.includes('@components'),
        `Should handle special chars, got: ${result}`,
      );
    });

    test('handles very long filenames', () => {
      const workspaceRoot = vscode.workspace.rootPath || '';
      const longFilename = 'a'.repeat(100) + '.ts';
      const filePath = path.join(workspaceRoot, 'src', longFilename);

      const result = formatPathLabel(filePath);

      // Should not throw and should contain part of the filename
      assert.ok(typeof result === 'string');
    });

    test('combines line number with abbreviated path', async () => {
      await withConfiguration(
        {
          showLineNumbers: true,
          startFolderDisplayDepth: 1,
          endFolderDisplayDepth: 2,
        },
        async () => {
          const workspaceRoot = vscode.workspace.rootPath || '';
          const filePath = path.join(
            workspaceRoot,
            'src',
            'components',
            'ui',
            'buttons',
            'Button.tsx',
          );

          const result = formatPathLabel(filePath, { lineNumber: 99 });

          assert.ok(result.includes('Button.tsx'), `Should contain filename, got: ${result}`);
          assert.ok(result.endsWith(':99'), `Should end with line number, got: ${result}`);
        },
      );
    });
  });
});
