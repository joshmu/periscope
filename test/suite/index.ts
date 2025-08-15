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
  // Configure Mocha with optional grep pattern from environment
  const mochaOptions: Mocha.MochaOptions = {
    ui: 'tdd',
    color: true,
  };

  // Support filtering tests by pattern via MOCHA_GREP environment variable
  if (process.env.MOCHA_GREP) {
    mochaOptions.grep = process.env.MOCHA_GREP;
    console.log(`[Test Suite] Filtering tests with pattern: ${process.env.MOCHA_GREP}`);
  }

  // Create the mocha test
  const mocha = new Mocha(mochaOptions);

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise(async (c, e) => {
    try {
      // Verify workspace before running tests
      await verifyWorkspace();
    } catch (error) {
      console.error('[Test Suite] Workspace verification failed:', error);
      return e(error);
    }

    // Support filtering by specific test file via TEST_FILE environment variable
    const testFilePattern = process.env.TEST_FILE
      ? `**/${process.env.TEST_FILE}.test.js`
      : '**/**.test.js';

    if (process.env.TEST_FILE) {
      console.log(`[Test Suite] Running specific test file: ${process.env.TEST_FILE}`);
    }

    glob(testFilePattern, { cwd: testsRoot, ignore: '**/fixtures/**' }, (err, files) => {
      if (err) {
        return e(err);
      }

      if (files.length === 0) {
        const errorMsg = process.env.TEST_FILE
          ? `No test file found matching: ${process.env.TEST_FILE}`
          : 'No test files found';
        console.error(`[Test Suite] ${errorMsg}`);
        return e(new Error(errorMsg));
      }

      console.log(`[Test Suite] Found ${files.length} test file(s)`);

      // Add files to the test suite
      files.forEach((f) => {
        const fullPath = path.resolve(testsRoot, f);
        console.log(`[Test Suite] Adding test file: ${f}`);
        mocha.addFile(fullPath);
      });

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
