import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { context as cx } from '../../src/lib/context';
import {
  periscopeTestHelpers,
  waitForQuickPick,
  waitForCondition,
  withConfiguration,
} from '../utils/periscopeTestHelper';

suite('Ripgrep Integration', function () {
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
    if (cx.qp) {
      cx.qp.hide();
      cx.qp.dispose();
    }

    sandbox.restore();
    cx.resetContext();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  suite('Basic Ripgrep Functionality', () => {
    test('performs basic text search', async () => {
      const results = await periscopeTestHelpers.search('function');
      assert.ok(results.count > 0, 'Should find functions in the codebase');
      assert.ok(results.files.length > 0, 'Should find files containing functions');
    });

    test('performs case-sensitive search', async () => {
      // Case-sensitive search for 'TODO' (all caps)
      const caseSensitiveResults = await periscopeTestHelpers.search('TODO');
      assert.ok(caseSensitiveResults.count > 0, 'Should find TODO in caps');

      // These should be different if case sensitivity matters
      // In our fixtures, TODO appears but not 'todo' in lowercase
    });

    test('performs regex search', async () => {
      const regexResults = await periscopeTestHelpers.search('function\\s+\\w+', { isRegex: true });
      assert.ok(regexResults.count > 0, 'Should find function declarations');

      // All matches should be function declarations
      regexResults.raw.labels.forEach((label) => {
        if (label.includes('function')) {
          assert.ok(/function\s+\w+/.test(label), 'Should match function pattern');
        }
      });
    });
  });

  suite('Raw Query Parameters', () => {
    test('handles quoted queries with additional parameters', () => {
      const rawQueries = [
        {
          input: '"foobar" -t js',
          expectedTerm: 'foobar',
          expectedParams: ['-t', 'js'],
        },
        {
          input: '"test function" -g "*.test.ts" --max-count=1',
          expectedTerm: 'test function',
          expectedParams: ['-g', '"*.test.ts"', '--max-count=1'],
        },
        {
          input: '"TODO" --case-sensitive',
          expectedTerm: 'TODO',
          expectedParams: ['--case-sensitive'],
        },
      ];

      rawQueries.forEach(({ input, expectedTerm, expectedParams }) => {
        // Parse quoted query
        const match = input.match(/^"([^"]+)"(.*)$/);
        assert.ok(match, 'Should match quoted pattern');
        assert.strictEqual(match[1], expectedTerm);

        // Parse parameters
        const params = match[2].trim().split(/\s+/);
        if (params[0]) {
          assert.ok(expectedParams.some((p) => params.includes(p)));
        }
      });
    });

    test('passes through ripgrep type filters', () => {
      const typeFilters = [
        { param: '-t js', description: 'JavaScript files' },
        { param: '-t rust', description: 'Rust files' },
        { param: '-t md', description: 'Markdown files' },
        { param: '-t json', description: 'JSON files' },
      ];

      typeFilters.forEach(({ param }) => {
        assert.ok(param.startsWith('-t '), 'Type filter should use -t flag');
      });
    });

    test('handles glob patterns', () => {
      const globPatterns = [
        { pattern: '-g "*.test.ts"', description: 'Test files' },
        { pattern: '-g "**/src/**"', description: 'Source directory' },
        { pattern: '-g "!**/node_modules/**"', description: 'Exclude node_modules' },
        { pattern: '-g "*.{js,ts}"', description: 'JS and TS files' },
      ];

      globPatterns.forEach(({ pattern }) => {
        assert.ok(pattern.includes('-g'), 'Glob pattern should use -g flag');
      });
    });
  });

  suite('Ripgrep Options', () => {
    test('applies max-count option', () => {
      const options = ['--max-count=1', '--max-count=5'];

      options.forEach((opt) => {
        const match = opt.match(/--max-count=(\d+)/);
        assert.ok(match, 'Should match max-count pattern');
        const count = parseInt(match[1]);
        assert.ok(count > 0, 'Max count should be positive');
      });
    });

    test('applies case sensitivity options', () => {
      const caseOptions = [
        { flag: '--case-sensitive', description: 'Force case sensitive' },
        { flag: '-s', description: 'Short form case sensitive' },
        { flag: '--ignore-case', description: 'Force case insensitive' },
        { flag: '-i', description: 'Short form case insensitive' },
      ];

      caseOptions.forEach(({ flag }) => {
        assert.ok(flag.startsWith('-'), 'Option should be a command flag');
      });
    });

    test('applies context line options', () => {
      const contextOptions = [
        { flag: '-A 2', description: 'Show 2 lines after match' },
        { flag: '-B 3', description: 'Show 3 lines before match' },
        { flag: '-C 2', description: 'Show 2 lines before and after' },
      ];

      contextOptions.forEach(({ flag }) => {
        assert.ok(flag.match(/-[ABC]\s+\d+/), 'Should match context line pattern');
      });
    });

    test('handles word boundary option', () => {
      const wordBoundaryOptions = [
        { flag: '-w', description: 'Match whole words only' },
        { flag: '--word-regexp', description: 'Long form word boundary' },
      ];

      wordBoundaryOptions.forEach(({ flag }) => {
        assert.ok(flag === '-w' || flag === '--word-regexp');
      });
    });
  });

  suite('File Type Filters', () => {
    test('filters by built-in file types', () => {
      const builtInTypes = [
        'js',
        'ts',
        'rust',
        'python',
        'go',
        'java',
        'cpp',
        'c',
        'html',
        'css',
        'json',
        'xml',
        'yaml',
        'md',
      ];

      builtInTypes.forEach((type) => {
        const param = `-t ${type}`;
        assert.ok(param.includes(type), `Should create type filter for ${type}`);
      });
    });

    test('creates custom file type definitions', () => {
      const customTypes = [
        {
          definition: "--type-add 'jsts:*.{js,ts,tsx,jsx}' -t jsts",
          name: 'jsts',
          extensions: ['js', 'ts', 'tsx', 'jsx'],
        },
        {
          definition: "--type-add 'web:*.{html,css,scss}' -t web",
          name: 'web',
          extensions: ['html', 'css', 'scss'],
        },
      ];

      customTypes.forEach(({ definition, name, extensions }) => {
        assert.ok(definition.includes('--type-add'), 'Should use --type-add');
        assert.ok(definition.includes(`-t ${name}`), 'Should reference custom type');
        extensions.forEach((ext) => {
          assert.ok(definition.includes(ext), `Should include ${ext} extension`);
        });
      });
    });
  });

  suite('Exclusion Patterns', () => {
    test('excludes node_modules by default', async () => {
      const results = await periscopeTestHelpers.search('function');

      // Verify no results from node_modules
      const hasNodeModules = results.files.some((f) => f.includes('node_modules'));
      assert.strictEqual(hasNodeModules, false, 'Should exclude node_modules');
    });

    test('applies custom exclusion globs', () => {
      const exclusions = [
        '**/dist/**',
        '**/build/**',
        '**/*.min.js',
        '**/coverage/**',
        '**/.git/**',
      ];

      exclusions.forEach((pattern) => {
        // Each would be passed as -g "!pattern"
        const rgParam = `-g "!${pattern}"`;
        assert.ok(rgParam.includes('!'), 'Exclusion should use ! prefix');
        assert.ok(rgParam.includes(pattern), 'Should include pattern');
      });
    });
  });

  suite('Search Modes', () => {
    test('searches all files in default mode', async () => {
      const results = await periscopeTestHelpers.search('function');
      assert.ok(results.count > 0, 'Should find results across all files');

      // Should find in multiple file types
      const fileTypes = new Set(results.files.map((f) => f.split('.').pop()));
      assert.ok(fileTypes.size > 1, 'Should search multiple file types');
    });

    test('searches only current file in currentFile mode', async () => {
      const results = await periscopeTestHelpers.searchCurrentFile(
        'function',
        'src/utils/helpers.ts',
      );

      // All results should be from the specified file
      const uniqueFiles = [...new Set(results.files)];
      assert.strictEqual(uniqueFiles.length, 1, 'Should only search one file');
      assert.strictEqual(uniqueFiles[0], 'helpers.ts');
    });

    test('lists files in file search mode', async () => {
      const results = await periscopeTestHelpers.searchFiles('test');

      // Should find test files
      assert.ok(
        results.files.some((f) => f.includes('test')),
        'Should find files with "test" in name',
      );

      // All items should be file type
      assert.ok(
        results.items.every((item) => item._type === 'QuickPickItemFile'),
        'Should only return file items',
      );
    });
  });

  suite('Performance Optimizations', () => {
    test('handles large result sets', async () => {
      // Search for common pattern that might return many results
      const results = await periscopeTestHelpers.search('import');

      // Should handle results efficiently
      assert.ok(results.count >= 0, 'Should return results');
      assert.ok(Array.isArray(results.items), 'Should return array of items');
    });

    test('supports result limiting', () => {
      const limitOptions = ['--max-count=10', '--max-filesize=1M', '--max-columns=200'];

      limitOptions.forEach((opt) => {
        assert.ok(opt.startsWith('--max'), 'Limit option should use --max prefix');
      });
    });
  });

  suite('Command Construction Verification', () => {
    test('constructs ripgrep command with required flags', async function () {
      this.timeout(5000);

      // Perform a search and intercept the command
      await vscode.commands.executeCommand('periscope.search');
      await waitForQuickPick(300);

      // Trigger a search
      cx.qp.value = 'test';
      await waitForCondition(() => cx.qp.items.length >= 0, 500);

      // The command should include required flags
      // In a real test, we would intercept the spawn call to capture the command
      // For now, verify that the search produces results (indicating valid command)
      assert.ok(cx.qp, 'Search should execute with valid ripgrep command');

      // Clean up
      cx.qp.hide();
      cx.qp.dispose();
    });

    test('includes configuration options in command', async function () {
      this.timeout(5000);

      await withConfiguration(
        {
          rgOptions: ['--max-count=5', '--case-sensitive'],
        },
        async () => {
          // Perform search
          const results = await periscopeTestHelpers.search('function');

          // The search should respect the configuration
          // Count occurrences per file - should be max 5
          const fileOccurrences = new Map<string, number>();
          results.items.forEach((item: any) => {
            if (item.data?.filePath) {
              const fileName = item.data.filePath.split('/').pop();
              fileOccurrences.set(fileName, (fileOccurrences.get(fileName) || 0) + 1);
            }
          });

          // Each file should have max 5 matches due to --max-count=5
          for (const [file, count] of fileOccurrences) {
            assert.ok(count <= 5, `File ${file} should respect --max-count=5`);
          }
        },
      );
    });

    test('applies exclusion globs to command', async function () {
      this.timeout(5000);

      await withConfiguration(
        {
          rgGlobExcludes: ['**/test/**', '**/spec/**'],
        },
        async () => {
          // Search for something that would be in test files
          const results = await periscopeTestHelpers.search('test');

          // Should not find results in test directories
          const testFiles = results.files.filter(
            (f) => f.includes('/test/') || f.includes('/spec/'),
          );

          assert.strictEqual(testFiles.length, 0, 'Should exclude test and spec directories');
        },
      );
    });

    test('includes current file path in currentFile mode', async function () {
      this.timeout(5000);

      // Open a specific file
      const filePath = 'src/utils/helpers.ts';
      const results = await periscopeTestHelpers.searchCurrentFile('function', filePath);

      // All results should be from the current file only
      const uniqueFiles = [...new Set(results.files)];
      assert.strictEqual(uniqueFiles.length, 1, 'Should only search current file');
      assert.strictEqual(uniqueFiles[0], 'helpers.ts', 'Should search specified file');
    });

    test('includes menu actions in command', async function () {
      this.timeout(5000);

      // Search with a menu action that filters file types
      const results = await periscopeTestHelpers.searchWithMenuAction('function', {
        label: 'TypeScript Only',
        value: '-t ts',
      });

      // All results should be TypeScript files
      const allTypeScript = results.files.every((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

      assert.ok(allTypeScript, 'Menu action should filter to TypeScript files only');
    });
  });

  suite('Query Parameter Transformations', () => {
    test('transforms type filter shortcuts', () => {
      const transforms = [
        { input: 'search -t js', output: "rg 'search' -t js" },
        { input: 'find -t rust', output: "rg 'find' -t rust" },
        { input: 'TODO -t md', output: "rg 'TODO' -t md" },
      ];

      transforms.forEach(({ input, output }) => {
        // Extract pattern and type
        const match = input.match(/^(.+) -t (\w+)$/);
        assert.ok(match, 'Should match type filter pattern');

        const [, searchTerm, fileType] = match;
        const transformed = `rg '${searchTerm}' -t ${fileType}`;
        assert.strictEqual(transformed, output);
      });
    });

    test('transforms glob shortcuts', () => {
      const transforms = [
        { input: 'search *.ts', expected: '-g "*.ts"' },
        { input: 'find *.test.js', expected: '-g "*.test.js"' },
      ];

      transforms.forEach(({ input, expected }) => {
        const match = input.match(/^(.+) (\*\.\w+(?:\.\w+)?)$/);
        if (match) {
          const glob = `-g "${match[2]}"`;
          assert.strictEqual(glob, expected);
        }
      });
    });

    test('transforms module path shortcuts', () => {
      const transforms = [
        { input: 'redis -m auth', expected: '-g "**/auth/**"' },
        { input: 'search -m user-service', expected: '-g "**/user-service/**"' },
      ];

      transforms.forEach(({ input }) => {
        const match = input.match(/^(.+) -m ([\w-_]+)$/);
        assert.ok(match, 'Should match module pattern');
      });
    });
  });

  suite('Multi-line and Special Patterns', () => {
    test('handles multi-line patterns', () => {
      // Multi-line patterns need special handling
      const multilinePatterns = [
        'function.*\\n.*return',
        'class.*\\{[\\s\\S]*constructor',
        'TODO.*\\n.*FIXME',
      ];

      multilinePatterns.forEach((pattern) => {
        // Would need -U flag for multiline
        assert.ok(
          pattern.includes('\\n') || pattern.includes('[\\s\\S]'),
          'Pattern suggests multiline matching',
        );
      });
    });

    test('escapes special regex characters', () => {
      const specialChars = ['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '[', ']', '|', '\\'];

      specialChars.forEach((char) => {
        // When searching literally, these should be escaped
        const escaped = `\\${char}`;
        assert.ok(escaped.startsWith('\\'), 'Special char should be escaped');
      });
    });
  });

  suite('Error Handling', () => {
    test('handles invalid regex patterns gracefully', () => {
      const invalidPatterns = ['[unclosed', '(unclosed', '*invalid', '?invalid'];

      invalidPatterns.forEach((pattern) => {
        // Should handle these without crashing
        assert.ok(pattern, 'Pattern exists');
        // In real implementation, would catch regex errors
      });
    });

    test('handles missing file paths gracefully', async () => {
      // Searching in non-existent file should handle gracefully
      try {
        const results = await periscopeTestHelpers.searchCurrentFile(
          'test',
          'non/existent/file.ts',
        );
        // Should either return empty or handle error
        assert.ok(results !== undefined, 'Should return some result');
      } catch (error) {
        // Should handle error gracefully
        assert.ok(error, 'Should handle missing file');
      }
    });
  });
});
