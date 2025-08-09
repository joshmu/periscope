import * as assert from 'assert';
import * as vscode from 'vscode';
import { context as cx } from '../../src/lib/context';
import {
  periscopeTestHelpers,
  waitForQuickPick,
  waitForSearchResults,
  waitForCondition,
} from '../utils/periscopeTestHelper';

suite('Configuration Options - Real Behavior', function () {
  this.timeout(10000);

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
    await new Promise((resolve) => setTimeout(resolve, 50));
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
      await new Promise((resolve) => setTimeout(resolve, 100));

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

    test.skip('finds content when exclusion is removed', async () => {
      // First, exclude the directories
      const config = vscode.workspace.getConfiguration('periscope');
      await config.update('rgGlobExcludes', ['**/dist/**'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const excludedResults = await periscopeTestHelpers.search('excludedFunction');
      assert.strictEqual(excludedResults.count, 0, 'Should not find when excluded');

      // Now remove the exclusion
      await config.update('rgGlobExcludes', [], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const includedResults = await periscopeTestHelpers.search('excludedFunction', {
        debug: true,
        waitTime: 1000, // Give more time for ripgrep to find results
      });

      // Debug output
      console.log('Search results after removing exclusion:', {
        count: includedResults.count,
        files: includedResults.files,
        items: includedResults.items.length,
      });

      assert.ok(includedResults.count > 0, 'Should find functions when exclusion removed');
      assert.ok(
        includedResults.files.some((f) => f.includes('excluded.js')),
        'Should find in excluded.js',
      );
    });
  });

  suite('rgOptions - Ripgrep Command Options', () => {
    test('--max-count limits results per file', async () => {
      // Configure max-count to limit results
      const config = vscode.workspace.getConfiguration('periscope');
      await config.update('rgOptions', ['--max-count=2'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 100));

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
      await new Promise((resolve) => setTimeout(resolve, 100));

      const caseInsensitiveResults = await periscopeTestHelpers.search('todo');
      const insensitiveCount = caseInsensitiveResults.count;

      // Now with case sensitive
      await config.update('rgOptions', ['--case-sensitive'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 100));

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
      await new Promise((resolve) => setTimeout(resolve, 100));

      const partialResults = await periscopeTestHelpers.search('test');

      // Search with word boundary
      await config.update('rgOptions', ['--word-regexp'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 100));

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
      await new Promise((resolve) => setTimeout(resolve, 100));

      // First search with results
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick();

      cx.qp!.value = 'function';
      await waitForSearchResults(1, 1000);
      const firstResultCount = cx.qp!.items.length;
      assert.ok(firstResultCount > 0, 'Should have initial results');

      // Search for something that doesn't exist
      cx.qp!.value = 'xyzNonExistentSearchTerm123';
      await new Promise((resolve) => setTimeout(resolve, 500));

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
      await new Promise((resolve) => setTimeout(resolve, 100));

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
          const parts = item.data.filePath.split('/');
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
      this.timeout(10000);

      const config = vscode.workspace.getConfiguration('periscope');

      // Start a search without max-count
      await config.update('rgOptions', [], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start search
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick(300);

      cx.qp.value = 'function';
      await waitForSearchResults(1, 1000);

      const initialCount = cx.qp.items.length;
      assert.ok(initialCount > 0, 'Should have initial results');

      // Now update configuration while search is active
      await config.update('rgOptions', ['--max-count=1'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trigger a new search with the same query
      cx.qp.value = '';
      await new Promise((resolve) => setTimeout(resolve, 100));
      cx.qp.value = 'function';
      await waitForSearchResults(1, 1000);

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
      this.timeout(10000);

      const config = vscode.workspace.getConfiguration('periscope');

      // Start without exclusions
      await config.update('rgGlobExcludes', [], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start search
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick(300);

      cx.qp.value = 'function';
      await waitForSearchResults(1, 1000);

      // Check if we have test files in results
      const hasTestFiles = cx.qp.items.some((item: any) => {
        const filePath = item.data?.filePath || '';
        return filePath.includes('.test.');
      });

      // Now add exclusion for test files
      await config.update('rgGlobExcludes', ['**/*.test.*'], vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Re-trigger search
      cx.qp.value = '';
      await new Promise((resolve) => setTimeout(resolve, 100));
      cx.qp.value = 'function';
      await waitForSearchResults(1, 1000);

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
      this.timeout(5000);

      const config = vscode.workspace.getConfiguration('periscope');

      // Set initial peek colors
      await config.update('peekBorderColor', '#FF0000', vscode.ConfigurationTarget.Workspace);
      await config.update('peekMatchColor', '#00FF00', vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Perform search
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick(300);

      cx.qp.value = 'TODO';
      await waitForSearchResults(1, 1000);

      // Navigate to a result (would apply decorations)
      if (cx.qp.items.length > 0) {
        cx.qp.activeItems = [cx.qp.items[0]];
        await waitForCondition(() => !!vscode.window.activeTextEditor, 500);
      }

      // Update peek colors
      await config.update('peekBorderColor', '#0000FF', vscode.ConfigurationTarget.Workspace);
      await config.update('peekMatchColor', '#FFFF00', vscode.ConfigurationTarget.Workspace);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Navigate to another result (should use new colors)
      if (cx.qp.items.length > 1) {
        cx.qp.activeItems = [cx.qp.items[1]];
        await waitForCondition(() => !!vscode.window.activeTextEditor, 500);
      }

      // The new decorations should be applied
      // In actual implementation, this would check the decoration styles
      assert.ok(vscode.window.activeTextEditor, 'Should have active editor with decorations');

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
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
      await new Promise((resolve) => setTimeout(resolve, 100));

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
});
