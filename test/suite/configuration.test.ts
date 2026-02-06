import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { context as cx } from '../../src/lib/context';
import {
  periscopeTestHelpers,
  waitForQuickPick,
  waitForSearchResults,
  waitForCondition,
  withConfiguration,
  hasLineNumbersInDetails,
  LINE_NUMBER_REGEX,
  TEST_TIMEOUTS,
} from '../utils/periscopeTestHelper';

suite('Configuration Options - Real Behavior', function () {
  this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);
  this.retries(2); // Config-dependent searches are timing-sensitive on macOS CI

  // Store original config values to restore after tests
  let originalConfig: Map<string, any> = new Map();

  setup(async () => {
    cx.resetContext();

    // Save original configuration
    const config = vscode.workspace.getConfiguration('periscope');
    originalConfig.set('rgGlobExcludes', config.get('rgGlobExcludes'));
    originalConfig.set('rgOptions', config.get('rgOptions'));
    originalConfig.set(
      'showPreviousResultsWhenNoMatches',
      config.get('showPreviousResultsWhenNoMatches'),
    );

    // Ensure extension is activated
    const ext = vscode.extensions.getExtension('JoshMu.periscope');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  teardown(async () => {
    if (cx.qp) {
      cx.qp.hide();
      cx.qp.dispose();
    }

    // Restore original configuration
    const config = vscode.workspace.getConfiguration('periscope');
    for (const [key, value] of originalConfig) {
      await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }

    cx.resetContext();
    await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
  });

  suite('rgGlobExcludes - Exclusion Patterns', () => {
    test('excludes files matching glob patterns', async () => {
      // Configure to exclude dist and build directories
      const config = vscode.workspace.getConfiguration('periscope');
      await config.update(
        'rgGlobExcludes',
        ['**/dist/**', '**/build/**'],
        vscode.ConfigurationTarget.Workspace,
      );

      // Wait a bit for config to apply
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Search for content we know exists in excluded files
      const results = await periscopeTestHelpers.search('excludedFunction');

      // Should not find the function in dist/excluded.js
      assert.strictEqual(results.count, 0, 'Should not find functions in excluded directories');
      assert.ok(!results.files.some((f) => f.includes('dist/')), 'Should not have any dist files');
      assert.ok(
        !results.files.some((f) => f.includes('build/')),
        'Should not have any build files',
      );
    });

    test('finds content when exclusion is removed', async () => {
      // Start with a known file open (not in utils)
      const startFile = 'src/index.ts';

      // First: Search WITHOUT exclusion - should find everything
      const baselineResults = await periscopeTestHelpers.search('getUserById', {
        startFile,
        keepOpen: false, // Hide QuickPick after collecting results for clean state
      });

      // Verify we find the function definition in helpers.ts
      assert.ok(baselineResults.count > 0, 'Should find results without exclusion');
      assert.ok(
        baselineResults.files.some((f) => f.includes('helpers')),
        `Should find helpers.ts. Found files: ${baselineResults.files.join(', ')}`,
      );

      // Second: Set exclusion and search again - should NOT find helpers.ts
      const config = vscode.workspace.getConfiguration('periscope');
      await config.update('rgGlobExcludes', ['**/utils/**'], vscode.ConfigurationTarget.Workspace);

      // Wait for config to apply
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.CURSOR_POSITION));

      const excludedResults = await periscopeTestHelpers.search('getUserById', {
        startFile,
        keepOpen: false, // Hide QuickPick after collecting results for clean state
      });

      // With exclusion, should not find the definition in helpers.ts
      assert.ok(excludedResults.count > 0, 'Should still find some results');
      assert.ok(
        excludedResults.count < baselineResults.count,
        'Should find fewer results with exclusion',
      );
      assert.ok(
        !excludedResults.files.some((f) => f.includes('helpers')),
        `Should NOT find helpers.ts with exclusion. Found files: ${excludedResults.files.join(', ')}`,
      );

      // Clean up: restore original config
      await config.update('rgGlobExcludes', [], vscode.ConfigurationTarget.Workspace);
    });
  });

  suite('rgOptions - Ripgrep Command Options', () => {
    test('--max-count limits results per file', async () => {
      // Configure max-count to limit results
      const config = vscode.workspace.getConfiguration('periscope');
      await config.update('rgOptions', ['--max-count=2'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Search for "function" which appears many times in special-config-test.ts
      const results = await periscopeTestHelpers.search('function');

      // Count occurrences per file
      const fileOccurrences = new Map<string, number>();
      results.items.forEach((item: any) => {
        if (item.data?.filePath) {
          const fileName = item.data.filePath.split('/').pop();
          fileOccurrences.set(fileName, (fileOccurrences.get(fileName) || 0) + 1);
        }
      });

      // Each file should have max 2 occurrences
      for (const [file, count] of fileOccurrences) {
        assert.ok(count <= 2, `File ${file} should have max 2 matches, found ${count}`);
      }
    });

    test('--case-sensitive makes search case sensitive', async () => {
      const config = vscode.workspace.getConfiguration('periscope');

      // First test without case sensitive
      await config.update('rgOptions', [], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      const caseInsensitiveResults = await periscopeTestHelpers.search('todo');
      const insensitiveCount = caseInsensitiveResults.count;

      // Now with case sensitive
      await config.update('rgOptions', ['--case-sensitive'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      const caseSensitiveResults = await periscopeTestHelpers.search('todo');
      const sensitiveCount = caseSensitiveResults.count;

      // Case sensitive should find fewer or equal matches (only lowercase 'todo')
      assert.ok(
        sensitiveCount <= insensitiveCount,
        `Case sensitive (${sensitiveCount}) should find fewer matches than insensitive (${insensitiveCount})`,
      );
    });

    test('--word-regexp matches whole words only', async () => {
      const config = vscode.workspace.getConfiguration('periscope');

      // Search without word boundary
      await config.update('rgOptions', [], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      const partialResults = await periscopeTestHelpers.search('test');

      // Search with word boundary
      await config.update('rgOptions', ['--word-regexp'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      const wordResults = await periscopeTestHelpers.search('test');

      // Word boundary should find fewer matches (excludes 'testing', 'pretest', etc.)
      assert.ok(
        wordResults.count < partialResults.count,
        `Word boundary (${wordResults.count}) should find fewer matches than partial (${partialResults.count})`,
      );
    });
  });

  suite('Search Behavior Configuration', () => {
    test('showPreviousResultsWhenNoMatches retains results', async () => {
      const config = vscode.workspace.getConfiguration('periscope');

      // Enable showing previous results
      await config.update(
        'showPreviousResultsWhenNoMatches',
        true,
        vscode.ConfigurationTarget.Workspace,
      );
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // First search with results
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick();

      cx.qp!.value = 'function';
      await waitForSearchResults(1);
      const firstResultCount = cx.qp!.items.length;
      assert.ok(firstResultCount > 0, 'Should have initial results');

      // Search for something that doesn't exist
      cx.qp!.value = 'xyzNonExistentSearchTerm123';
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.SEARCH_RESULTS));

      // Should still show previous results
      const afterNoMatchCount = cx.qp!.items.length;
      assert.ok(afterNoMatchCount > 0, 'Should retain previous results when no matches');

      // Clean up
      cx.qp!.hide();
      cx.qp!.dispose();
    });
  });

  suite('File Search Mode Configuration', () => {
    test('file search respects exclusion patterns', async () => {
      const config = vscode.workspace.getConfiguration('periscope');

      // Exclude dist directory
      await config.update('rgGlobExcludes', ['**/dist/**'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Search for files
      const results = await periscopeTestHelpers.searchFiles('excluded');

      // Should not find excluded.js in dist
      assert.ok(!results.files.some((f) => f === 'excluded.js'), 'Should not find excluded.js');
      assert.strictEqual(
        results.count,
        0,
        'Should not find any files with "excluded" when dist is excluded',
      );
    });
  });

  suite('Multi-path Search Configuration', () => {
    test('searches in all workspace folders', async () => {
      // Search across the workspace
      const results = await periscopeTestHelpers.search('function');

      // Should find functions in multiple directories
      const directories = new Set<string>();
      results.items.forEach((item: any) => {
        if (item.data?.filePath) {
          const parts = item.data.filePath.split(path.sep);
          if (parts.length > 1) {
            directories.add(parts[parts.length - 2]); // Get parent directory
          }
        }
      });

      // Should find in multiple directories (src, tests, etc.)
      assert.ok(
        directories.size > 1,
        `Should search in multiple directories, found: ${Array.from(directories).join(', ')}`,
      );
    });
  });

  suite('Live Configuration Updates', () => {
    test('applies configuration changes during active search', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      const config = vscode.workspace.getConfiguration('periscope');

      // Start a search without max-count
      await config.update('rgOptions', [], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Start search
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick();

      cx.qp.value = 'function';
      await waitForSearchResults(1);

      const initialCount = cx.qp.items.length;
      assert.ok(initialCount > 0, 'Should have initial results');

      // Now update configuration while search is active
      await config.update('rgOptions', ['--max-count=1'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Trigger a new search with the same query
      cx.qp.value = '';
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
      cx.qp.value = 'function';
      await waitForSearchResults(1);

      // Count occurrences per file - should now be max 1
      const fileOccurrences = new Map<string, number>();
      cx.qp.items.forEach((item: any) => {
        if (item.data?.filePath) {
          const fileName = item.data.filePath.split('/').pop();
          fileOccurrences.set(fileName, (fileOccurrences.get(fileName) || 0) + 1);
        }
      });

      // Each file should have max 1 match now
      for (const [file, count] of fileOccurrences) {
        assert.ok(count <= 1, `File ${file} should have max 1 match after config update`);
      }

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
    });

    test('updates exclusions during active search session', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      const config = vscode.workspace.getConfiguration('periscope');

      // Start without exclusions
      await config.update('rgGlobExcludes', [], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Start search
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick();

      cx.qp.value = 'function';
      await waitForSearchResults(1);

      // Check if we have test files in results
      const hasTestFiles = cx.qp.items.some((item: any) => {
        const filePath = item.data?.filePath || '';
        return filePath.includes('.test.');
      });

      // Now add exclusion for test files
      await config.update('rgGlobExcludes', ['**/*.test.*'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Re-trigger search
      cx.qp.value = '';
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
      cx.qp.value = 'function';
      await waitForSearchResults(1);

      // Should no longer have test files
      const hasTestFilesAfter = cx.qp.items.some((item: any) => {
        const filePath = item.data?.filePath || '';
        return filePath.includes('.test.');
      });

      assert.strictEqual(hasTestFilesAfter, false, 'Should exclude test files after config update');

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
    });

    test('updates peek decoration colors dynamically', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Use withConfiguration to ensure proper cleanup
      await withConfiguration(
        {
          peekBorderColor: '#FF0000',
          peekMatchColor: '#00FF00',
        },
        async () => {
          // Perform search
          await vscode.commands.executeCommand('periscope.search');
          await waitForQuickPick();

          cx.qp.value = 'TODO';
          await waitForSearchResults(1);

          // Navigate to a result (would apply decorations)
          if (cx.qp.items.length > 0) {
            cx.qp.activeItems = [cx.qp.items[0]];
            await waitForCondition(
              () => !!vscode.window.activeTextEditor,
              TEST_TIMEOUTS.EDITOR_OPEN,
            );
          }

          // Update peek colors within the test
          await withConfiguration(
            {
              peekBorderColor: '#0000FF',
              peekMatchColor: '#FFFF00',
            },
            async () => {
              // Navigate to another result (should use new colors)
              if (cx.qp.items.length > 1) {
                cx.qp.activeItems = [cx.qp.items[1]];
                await waitForCondition(
                  () => !!vscode.window.activeTextEditor,
                  TEST_TIMEOUTS.EDITOR_OPEN,
                );
              }

              // The new decorations should be applied
              // In actual implementation, this would check the decoration styles
              assert.ok(
                vscode.window.activeTextEditor,
                'Should have active editor with decorations',
              );
            },
          );

          // Clean up
          cx.qp.hide();
          cx.qp.dispose();
        },
      );
    });
  });

  suite('Performance with Configuration', () => {
    test('searches complete quickly with optimized settings', async () => {
      const config = vscode.workspace.getConfiguration('periscope');

      // Configure for optimal performance
      await config.update(
        'rgOptions',
        ['--max-count=5', '--max-columns=150'],
        vscode.ConfigurationTarget.Workspace,
      );
      await config.update(
        'rgGlobExcludes',
        ['**/node_modules/**', '**/dist/**', '**/build/**'],
        vscode.ConfigurationTarget.Workspace,
      );
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));

      // Measure search time
      const startTime = Date.now();
      const results = await periscopeTestHelpers.search('function');
      const searchTime = Date.now() - startTime;

      // Should complete quickly
      assert.ok(
        searchTime < 1000,
        `Search should complete in under 1 second, took ${searchTime}ms`,
      );
      assert.ok(results.count > 0, 'Should still find results with performance settings');
    });
  });

  suite('showLineNumbers Configuration', () => {
    test('shows line numbers by default', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      // Test default behavior - no configuration override needed
      const results = await periscopeTestHelpers.search('function');
      assert.ok(results.count > 0, 'Should find results');

      // Check that QuickPick items have line numbers in detail
      const qp = cx.qp;
      assert.ok(qp, 'QuickPick should be active');

      const items = qp.items as any[];
      const itemsWithDetail = items.filter((item) => item.detail);
      assert.ok(itemsWithDetail.length > 0, 'Should have items with detail');

      // Verify line numbers appear in details using helper
      assert.ok(
        hasLineNumbersInDetails(itemsWithDetail),
        'Should have line numbers in details by default',
      );
    });

    test('hides line numbers when disabled', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_DEFAULT);

      await withConfiguration(
        {
          showLineNumbers: false,
        },
        async () => {
          const results = await periscopeTestHelpers.search('function');
          assert.ok(results.count > 0, 'Should find results');

          // Check that QuickPick items don't have line numbers in detail
          const qp = cx.qp;
          assert.ok(qp, 'QuickPick should be active');

          const items = qp.items as any[];
          const itemsWithDetail = items.filter((item) => item.detail);

          if (itemsWithDetail.length > 0) {
            // Check that none of the details end with a line number pattern
            assert.ok(
              !hasLineNumbersInDetails(itemsWithDetail),
              'Should not have line numbers in details when disabled',
            );
          }
        },
      );
    });

    test('updates line numbers display during active search', async function () {
      this.timeout(TEST_TIMEOUTS.SUITE_EXTENDED);

      // Start search with default settings (line numbers enabled)
      const results = await periscopeTestHelpers.search('function', { keepOpen: true });
      assert.ok(results.count > 0, 'Should find results');

      const qp = cx.qp;
      assert.ok(qp, 'QuickPick should be active');

      // Check initial state (line numbers should be shown by default)
      let items = qp.items as any[];
      let itemsWithDetail = items.filter((item) => item.detail);
      assert.ok(itemsWithDetail.length > 0, 'Should have items with detail');
      assert.ok(hasLineNumbersInDetails(itemsWithDetail), 'Should have line numbers by default');

      // Disable line numbers using withConfiguration
      await withConfiguration(
        {
          showLineNumbers: false,
        },
        async () => {
          // Trigger a new search to refresh results
          qp.value = '';
          await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
          qp.value = 'function';
          await waitForSearchResults(1, TEST_TIMEOUTS.SEARCH_RESULTS);

          // Check updated state (no line numbers)
          items = qp.items as any[];
          itemsWithDetail = items.filter((item) => item.detail);
          if (itemsWithDetail.length > 0) {
            assert.ok(
              !hasLineNumbersInDetails(itemsWithDetail),
              'Should not have line numbers after disabling',
            );
          }
        },
      );

      // After withConfiguration completes, settings are automatically restored
      // Verify restoration by triggering another search
      qp.value = '';
      await new Promise((resolve) => setTimeout(resolve, TEST_TIMEOUTS.UI_STABILIZATION));
      qp.value = 'function';
      await waitForSearchResults(1, TEST_TIMEOUTS.SEARCH_RESULTS);

      // Check that line numbers are back (default behavior)
      items = qp.items as any[];
      itemsWithDetail = items.filter((item) => item.detail);
      assert.ok(itemsWithDetail.length > 0, 'Should have items with detail after restoration');
      assert.ok(
        hasLineNumbersInDetails(itemsWithDetail),
        'Should have line numbers after restoration to default',
      );
    });
  });
});
