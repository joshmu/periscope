import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Test fixture loader for Periscope tests
 * Provides utilities to work with the test fixture workspace
 */
export class FixtureLoader {
  private static readonly FIXTURE_PATH = path.join(__dirname, 'workspace');

  /**
   * Get the absolute path to the fixture workspace
   */
  static getWorkspacePath(): string {
    return this.FIXTURE_PATH;
  }

  /**
   * Get the path to a specific file in the fixture workspace
   */
  static getFilePath(relativePath: string): string {
    return path.join(this.FIXTURE_PATH, relativePath);
  }

  /**
   * Get expected search results for common test queries
   */
  static getExpectedResults() {
    return {
      // Text search expectations
      textSearch: {
        TODO: [
          {
            file: 'src/components/Button.tsx',
            line: 9,
            text: '// TODO: Add prop validation for accessibility',
          },
          {
            file: 'src/components/Button.tsx',
            line: 26,
            text: '// TODO: Implement button group component',
          },
          { file: 'tests/integration.test.ts', line: 26, text: '    // TODO: Add API mocking' },
        ],
        getUserById: [
          {
            file: 'src/utils/helpers.ts',
            line: 1,
            text: 'export function getUserById(id: string) {',
          },
          {
            file: 'src/index.ts',
            line: 3,
            text: "import { getUserById, formatDate } from './utils/helpers';",
          },
          { file: 'src/index.ts', line: 11, text: "  const user = getUserById('123');" },
          {
            file: 'tests/unit.test.ts',
            line: 2,
            text: "import { getUserById, validateEmail } from '../src/utils/helpers';",
          },
          { file: 'tests/unit.test.ts', line: 6, text: "    const user = getUserById('123');" },
        ],
        FIXME: [
          {
            file: 'tests/integration.test.ts',
            line: 5,
            text: '    // FIXME: Setup test database connection',
          },
          { file: 'tests/integration.test.ts', line: 10, text: '    // FIXME: Clean up test data' },
          {
            file: 'tests/integration.test.ts',
            line: 19,
            text: '    // FIXME: Implement proper async handling',
          },
        ],
        '^import': [
          { file: 'src/components/Button.tsx', line: 1, text: "import React from 'react';" },
          { file: 'src/components/Header.tsx', line: 1, text: "import React from 'react';" },
          {
            file: 'src/components/Header.tsx',
            line: 2,
            text: "import { Button } from './Button';",
          },
          { file: 'src/index.ts', line: 1, text: "import { Button } from './components/Button';" },
          { file: 'src/index.ts', line: 2, text: "import { Header } from './components/Header';" },
          {
            file: 'src/index.ts',
            line: 3,
            text: "import { getUserById, formatDate } from './utils/helpers';",
          },
          { file: 'src/index.ts', line: 4, text: "import { Logger } from './utils/logger';" },
          {
            file: 'tests/unit.test.ts',
            line: 1,
            text: "import { describe, it, expect } from '@jest/globals';",
          },
          {
            file: 'tests/unit.test.ts',
            line: 2,
            text: "import { getUserById, validateEmail } from '../src/utils/helpers';",
          },
          {
            file: 'tests/integration.test.ts',
            line: 1,
            text: "import { describe, it, beforeAll, afterAll } from '@jest/globals';",
          },
        ],
        'log.*Error': [
          {
            file: 'src/utils/logger.ts',
            line: 28,
            text: "    log.writeError('Failed to establish database connection');",
          },
          {
            file: 'src/utils/logger.ts',
            line: 35,
            text: "    log.fatalError('No data provided');",
          },
        ],
        'function\\s+\\w+': [
          {
            file: 'src/components/Button.tsx',
            line: 10,
            text: "export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {",
          },
          {
            file: 'src/components/Header.tsx',
            line: 4,
            text: 'function renderHeader(title: string) {',
          },
          { file: 'src/components/Header.tsx', line: 8, text: 'export function Header() {' },
          {
            file: 'src/components/Header.tsx',
            line: 13,
            text: '  function getNavigationItems() {',
          },
          {
            file: 'src/utils/helpers.ts',
            line: 1,
            text: 'export function getUserById(id: string) {',
          },
          {
            file: 'src/utils/helpers.ts',
            line: 9,
            text: 'export function formatDate(date: Date): string {',
          },
          {
            file: 'src/utils/helpers.ts',
            line: 13,
            text: 'export function validateEmail(email: string): boolean {',
          },
          {
            file: 'src/utils/helpers.ts',
            line: 19,
            text: 'export function parseQueryString(query: string): Record<string, string> {',
          },
          { file: 'src/utils/logger.ts', line: 22, text: 'export function connectToDatabase() {' },
          {
            file: 'src/utils/logger.ts',
            line: 32,
            text: 'export function processRequest(data: any) {',
          },
          { file: 'src/index.ts', line: 7, text: 'export function initializeApp() {' },
        ],
      },

      // File search expectations
      fileSearch: {
        Button: ['src/components/Button.tsx'],
        '.test': ['tests/unit.test.ts', 'tests/integration.test.ts'],
        'src/utils': ['src/utils/helpers.ts', 'src/utils/logger.ts'],
        helpers: ['src/utils/helpers.ts'],
        '.tsx': ['src/components/Button.tsx', 'src/components/Header.tsx'],
        '.json': ['config/settings.json', 'package.json'],
        README: ['docs/README.md'],
      },
    };
  }

  /**
   * Create a mock workspace folder for testing
   */
  static getMockWorkspaceFolder(): vscode.WorkspaceFolder {
    return {
      uri: vscode.Uri.file(this.FIXTURE_PATH),
      name: 'test-workspace',
      index: 0,
    };
  }

  /**
   * Get test scenarios for different search modes
   */
  static getTestScenarios() {
    return {
      // Test searching for TODO comments
      todoSearch: {
        query: 'TODO',
        expectedCount: 3, // Should not include node_modules
        shouldNotContain: 'node_modules',
      },

      // Test regex search
      regexSearch: {
        query: 'function\\s+\\w+',
        isRegex: true,
        minResults: 5,
      },

      // Test file search
      fileSearch: {
        query: 'Button',
        mode: 'files',
        expectedFiles: ['Button.tsx'],
      },

      // Test current file search (when helpers.ts is open)
      currentFileSearch: {
        query: 'function',
        mode: 'currentFile',
        currentFile: 'src/utils/helpers.ts',
        expectedCount: 4, // Only functions in helpers.ts
      },

      // Test exclusion patterns
      exclusionTest: {
        query: 'getUserById',
        shouldExclude: ['node_modules'],
        expectedFiles: ['helpers.ts', 'index.ts', 'unit.test.ts'],
      },
    };
  }
}
