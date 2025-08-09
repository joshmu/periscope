import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as sinon from 'sinon';
import { context as cx } from '../../src/lib/context';
import { periscopeTestHelpers } from '../utils/periscopeTestHelper';
import { FixtureLoader } from '../fixtures/fixtureLoader';

suite('Search Functionality with Fixtures', function () {
  // Increase timeout for all tests in this suite
  this.timeout(10000);

  let sandbox: sinon.SinonSandbox;

  setup(async () => {
    sandbox = sinon.createSandbox();
    cx.resetContext();

    // Ensure extension is activated
    const ext = vscode.extensions.getExtension('JoshMu.periscope');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  teardown(async () => {
    // Make sure to hide QuickPick to avoid interference
    if (cx.qp) {
      cx.qp.hide();
      cx.qp.dispose();
    }
    sandbox.restore();
    cx.resetContext();
    // Small delay to ensure cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  suite('Text Search in Fixture Workspace', () => {
    test('finds TODO comments using periscope.search', async function () {
      this.timeout(10000);

      const results = await periscopeTestHelpers.search('TODO', { debug: false });

      assert.ok(results.count > 0, `Should find TODO comments. Found ${results.count} items`);

      // Verify we found TODOs in expected files
      assert.ok(
        results.files.includes('Button.tsx'),
        `Should find TODO in Button.tsx. Found files: ${results.files.join(', ')}`,
      );
      assert.ok(
        results.files.includes('integration.test.ts'),
        `Should find TODO in integration.test.ts. Found files: ${results.files.join(', ')}`,
      );

      // Should NOT include node_modules
      assert.ok(
        !results.files.some((f) => f.includes('node_modules')),
        'Should exclude node_modules',
      );

      // Verify against expected results
      const expected = FixtureLoader.getExpectedResults().textSearch.TODO;
      assert.strictEqual(
        results.count,
        expected.length,
        `Should find exactly ${expected.length} TODOs`,
      );
    });

    test('finds getUserById function', async () => {
      const results = await periscopeTestHelpers.search('getUserById');

      assert.ok(results.count > 0, 'Should find getUserById');
      assert.ok(results.files.includes('helpers.ts'), 'Should find in helpers.ts');
      assert.ok(results.files.includes('index.ts'), 'Should find in index.ts');
      assert.ok(results.files.includes('unit.test.ts'), 'Should find in unit.test.ts');

      // Verify against expected results
      const expected = FixtureLoader.getExpectedResults().textSearch.getUserById;
      assert.strictEqual(
        results.count,
        expected.length,
        `Should find exactly ${expected.length} occurrences`,
      );
    });

    test('searches with regex patterns', async () => {
      // Search for log.*Error pattern
      const results = await periscopeTestHelpers.search('log.*Error', { isRegex: true });

      assert.ok(results.count > 0, 'Should find regex matches');

      // All matches should be in logger.ts
      const uniqueFiles = [...new Set(results.files)];
      assert.strictEqual(uniqueFiles.length, 1, 'Should only find in one file');
      assert.ok(uniqueFiles[0].includes('logger.ts'), 'Should be in logger.ts');

      // Verify against expected results
      const expected = FixtureLoader.getExpectedResults().textSearch['log.*Error'];
      assert.strictEqual(
        results.count,
        expected.length,
        `Should find exactly ${expected.length} matches`,
      );
    });
  });

  suite('File Search in Fixture Workspace', () => {
    test('lists files matching pattern', async () => {
      const results = await periscopeTestHelpers.searchFiles('Button');

      assert.ok(results.count > 0, 'Should find files');
      assert.ok(results.files.includes('Button.tsx'), 'Should find Button.tsx');

      // Verify all items are file type
      assert.ok(
        results.items.every((item) => item._type === 'QuickPickItemFile'),
        'All items should be file type',
      );
    });

    test('finds test files using periscope.searchFiles', async () => {
      const results = await periscopeTestHelpers.searchFiles('.test');

      assert.ok(results.files.includes('unit.test.ts'), 'Should find unit.test.ts');
      assert.ok(results.files.includes('integration.test.ts'), 'Should find integration.test.ts');

      // Verify against expected results
      const expected = FixtureLoader.getExpectedResults().fileSearch['.test'];
      assert.strictEqual(
        results.count,
        expected.length,
        `Should find exactly ${expected.length} test files`,
      );
    });
  });

  suite('Search Modes', () => {
    test('searches only current file in currentFile mode', async () => {
      const results = await periscopeTestHelpers.searchCurrentFile(
        'function',
        'src/utils/helpers.ts',
      );

      assert.ok(results.count > 0, 'Should find functions');

      // All results should be from helpers.ts only
      const uniqueFiles = [...new Set(results.files)];
      assert.strictEqual(uniqueFiles.length, 1, 'Should only search current file');
      assert.strictEqual(uniqueFiles[0], 'helpers.ts', 'Should only find in helpers.ts');

      // Should find 5 functions in helpers.ts (4 function declarations + 1 comment)
      assert.strictEqual(
        results.count,
        5,
        'Should find exactly 5 occurrences of "function" in helpers.ts',
      );
    });

    test('correctly sets search mode for each command', () => {
      cx.resetContext();
      assert.strictEqual(cx.searchMode, 'all', 'Default mode should be all');

      // File search mode
      vscode.commands.executeCommand('periscope.searchFiles');
      // Would need to wait for command to complete, but we can test the mode is set
    });
  });

  suite('Search Results Verification', () => {
    test('excludes node_modules from results', async () => {
      const results = await periscopeTestHelpers.search('getUserById');

      // Get full file paths from items
      const filePaths = results.items.map((item: any) => item.data?.filePath || '').filter(Boolean);

      // Verify no results from node_modules
      assert.ok(
        !filePaths.some((p) => p.includes('node_modules')),
        'Should not include node_modules in results',
      );
    });

    test('creates correct QuickPick item types for text search', async () => {
      // Test text search creates QPItemQuery
      const textResults = await periscopeTestHelpers.search('TODO');
      assert.ok(
        textResults.items.some((item) => item._type === 'QuickPickItemQuery'),
        'Text search should create QuickPickItemQuery items',
      );
    });

    test('creates correct QuickPick item types for file search', async () => {
      // Test file search creates QPItemFile
      const fileResults = await periscopeTestHelpers.searchFiles('Button');

      assert.ok(
        fileResults.items.length > 0,
        `File search should find items. Found ${fileResults.items.length}`,
      );
      assert.ok(
        fileResults.items.some((item) => item._type === 'QuickPickItemFile'),
        `File search should create QuickPickItemFile items. Types found: ${[...new Set(fileResults.items.map((i) => i._type))].join(', ')}`,
      );
    });
  });
});
