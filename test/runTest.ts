import * as path from 'path';

import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Set environment variables for testing
    // Open the fixture workspace for testing - use source directory not compiled
    const testWorkspace = path.resolve(__dirname, '../../test/fixtures/workspace');
    const launchArgs: string[] = [testWorkspace];
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      VSCODE_TEST: 'true',
    };

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs,
      extensionTestsEnv: env,
    });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();
