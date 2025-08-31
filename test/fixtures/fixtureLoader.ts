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
   * Create a mock workspace folder for testing
   */
  static getMockWorkspaceFolder(): vscode.WorkspaceFolder {
    return {
      uri: vscode.Uri.file(this.FIXTURE_PATH),
      name: 'test-workspace',
      index: 0,
    };
  }

}
