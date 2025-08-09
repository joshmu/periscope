/* eslint-disable consistent-return */
import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';
import * as vscode from 'vscode';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.VSCODE_TEST = 'true';

async function verifyWorkspace(): Promise<void> {
  // Verify workspace is loaded
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder is opened for testing');
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  console.log(`[Test Suite] Workspace loaded: ${workspacePath}`);

  // Verify it's the fixture workspace
  if (!workspacePath.includes('fixtures/workspace')) {
    console.warn('[Test Suite] Warning: Not using fixture workspace');
  }

  // Ensure Periscope extension is activated
  const ext = vscode.extensions.getExtension('JoshMu.periscope');
  if (ext && !ext.isActive) {
    await ext.activate();
    console.log('[Test Suite] Periscope extension activated');
  }
}

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise(async (c, e) => {
    try {
      // Verify workspace before running tests
      await verifyWorkspace();
    } catch (error) {
      console.error('[Test Suite] Workspace verification failed:', error);
      return e(error);
    }

    glob('**/**.test.js', { cwd: testsRoot, ignore: '**/fixtures/**' }, (err, files) => {
      if (err) {
        return e(err);
      }

      // Add files to the test suite
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        // Run the mocha test
        mocha.run((failures) => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (error) {
        console.error(error);
        if (error instanceof Error) {
          e(error);
        }
      }
    });
  });
}
