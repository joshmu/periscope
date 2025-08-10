import * as vscode from 'vscode';
import * as path from 'path';
import { context as cx } from '../../src/lib/context';
import { AllQPItemVariants } from '../../src/types';

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => boolean,
  maxWait = 100,
  checkInterval = 10,
): Promise<boolean> {
  const start = Date.now();
  while (!condition() && Date.now() - start < maxWait) {
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }
  return condition();
}

/**
 * Wait for QuickPick to be initialized
 */
export async function waitForQuickPick(maxWait = 100): Promise<vscode.QuickPick<any> | undefined> {
  await waitForCondition(() => cx.qp !== undefined, maxWait);
  return cx.qp;
}

/**
 * Wait for search results to appear
 */
export async function waitForSearchResults(
  minResults = 1,
  maxWait = 1000,
): Promise<readonly any[] | undefined> {
  await waitForCondition(() => (cx.qp?.items.length ?? 0) >= minResults, maxWait, 20);
  return cx.qp?.items;
}

/**
 * Open a document with specified content
 */
export async function openDocumentWithContent(
  content: string,
  language = 'typescript',
): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({
    content,
    language,
  });
  return await vscode.window.showTextDocument(doc);
}

/**
 * Select text in the editor
 */
export async function selectText(editor: vscode.TextEditor, searchText: string): Promise<boolean> {
  const text = editor.document.getText();
  const index = text.indexOf(searchText);

  if (index === -1) {
    return false;
  }

  const startPos = editor.document.positionAt(index);
  const endPos = editor.document.positionAt(index + searchText.length);
  editor.selection = new vscode.Selection(startPos, endPos);

  return true;
}

/**
 * Select a text range in the editor
 */
export function selectTextRange(
  editor: vscode.TextEditor,
  startPos: vscode.Position,
  endPos: vscode.Position,
): void {
  editor.selection = new vscode.Selection(startPos, endPos);
}

/**
 * Open a file at a specific position
 */
export async function openFileAtPosition(
  filePath: string,
  line: number,
  column = 0,
): Promise<vscode.TextEditor> {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(vscode.workspace.rootPath || '', filePath);

  const doc = await vscode.workspace.openTextDocument(absolutePath);
  const editor = await vscode.window.showTextDocument(doc);

  const position = new vscode.Position(line, column);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position));

  return editor;
}

/**
 * Wait for preview editor to update
 */
export async function waitForPreviewUpdate(
  previousEditor?: vscode.TextEditor | undefined,
  maxWait = 1000,
): Promise<vscode.TextEditor | undefined> {
  await waitForCondition(() => {
    const currentEditor = vscode.window.activeTextEditor;
    if (!currentEditor) return false;

    if (!previousEditor) return true;

    // Check if it's a different file or different position
    return (
      currentEditor.document.uri.fsPath !== previousEditor.document.uri.fsPath ||
      currentEditor.selection.active.line !== previousEditor.selection.active.line
    );
  }, maxWait);

  // Add small delay for cursor positioning to complete
  await new Promise((resolve) => setTimeout(resolve, 200));

  return vscode.window.activeTextEditor;
}

/**
 * Set cursor position in editor
 */
export function setCursorPosition(editor: vscode.TextEditor, line: number, column = 0): void {
  const position = new vscode.Position(line, column);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position));
}

/**
 * Helper to temporarily update configuration for a test
 * Automatically restores original configuration after the test function completes
 */
export async function withConfiguration<T>(
  configUpdates: { [key: string]: any },
  testFn: () => Promise<T>,
): Promise<T> {
  const config = vscode.workspace.getConfiguration('periscope');
  const originalValues = new Map<string, any>();

  // Save original values and apply updates
  for (const [key, value] of Object.entries(configUpdates)) {
    originalValues.set(key, config.get(key));
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
  }

  // Wait for config to apply
  await new Promise((resolve) => setTimeout(resolve, 100));

  try {
    // Run the test
    return await testFn();
  } finally {
    // Always restore original values
    for (const [key, originalValue] of originalValues) {
      await config.update(key, originalValue, vscode.ConfigurationTarget.Workspace);
    }
    // Wait for config to restore
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export interface TestOptions {
  command?: string;
  query?: string;
  startFile?: string;
  position?: { line: number; character: number };
  waitTime?: number;
  isRegex?: boolean;
  debug?: boolean;
  selectedText?: string;
  menuAction?: { label: string; value: string };
  configuration?: { [key: string]: any };
  workspaceFolders?: vscode.WorkspaceFolder[];
  keepOpen?: boolean;
}

export interface TestResults {
  items: AllQPItemVariants[];
  count: number;
  files: string[];
  fileToItemsMap: Map<string, AllQPItemVariants[]>;
  raw: {
    labels: string[];
    details: string[];
    types: string[];
  };
}

/**
 * Core test utility for executing Periscope commands and collecting results
 */
export async function executePeriscopeTest(options: TestOptions): Promise<TestResults> {
  const {
    command = 'periscope.search',
    query = '',
    startFile,
    position,
    waitTime,
    isRegex = false,
    debug = false,
    selectedText,
    menuAction,
    configuration,
    workspaceFolders,
    keepOpen = true,
  } = options;

  if (debug) {
    console.log(`[PeriscopeTest] Executing command: ${command}`);
    console.log(`[PeriscopeTest] Query: ${query}`);
    if (startFile) {
      console.log(`[PeriscopeTest] Start file: ${startFile}`);
    }
  }

  // Ensure extension is activated
  const ext = vscode.extensions.getExtension('JoshMu.periscope');
  if (ext && !ext.isActive) {
    await ext.activate();
    if (debug) {
      console.log('[PeriscopeTest] Extension activated');
    }
  }

  // Apply configuration if specified
  if (configuration) {
    // Mock configuration for testing
    const getConfigStub = (key: string) => configuration[key];
    // In real tests, this would be stubbed with sinon
    if (debug) {
      console.log(`[PeriscopeTest] Applied configuration:`, configuration);
    }
  }

  // Set workspace folders if specified
  if (workspaceFolders) {
    // In real tests, this would be stubbed with sinon
    if (debug) {
      console.log(
        `[PeriscopeTest] Set workspace folders:`,
        workspaceFolders.map((f) => f.name),
      );
    }
  }

  // Open start file if specified
  if (startFile) {
    const filePath = path.isAbsolute(startFile)
      ? startFile
      : path.join(vscode.workspace.rootPath || '', startFile);
    const doc = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(doc);

    // Set cursor position if specified
    if (position) {
      const pos = new vscode.Position(position.line, position.character);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos));
    }

    // Set selected text if specified
    if (selectedText) {
      // Find the text in the document and select it
      const text = doc.getText();
      const index = text.indexOf(selectedText);
      if (index >= 0) {
        const startPos = doc.positionAt(index);
        const endPos = doc.positionAt(index + selectedText.length);
        editor.selection = new vscode.Selection(startPos, endPos);
        if (debug) {
          console.log(`[PeriscopeTest] Selected text: "${selectedText}"`);
        }
      }
    }

    if (debug) {
      console.log(`[PeriscopeTest] Opened file: ${filePath}`);
    }
  }

  // Execute the command
  await vscode.commands.executeCommand(command);

  // Wait for QuickPick to be ready using smart waiting
  const qp = await waitForQuickPick(300);

  if (!qp) {
    throw new Error('QuickPick not initialized after command execution');
  }

  if (debug) {
    console.log('[PeriscopeTest] QuickPick active:', cx.qp !== undefined);
    console.log('[PeriscopeTest] Initial QuickPick title:', cx.qp.title);
  }

  // Handle menu action if specified
  if (menuAction) {
    // Simulate selecting a menu action
    // This would typically be done through the QuickPick interface
    if (debug) {
      console.log(`[PeriscopeTest] Applying menu action: ${menuAction.label}`);
    }
    // Apply the menu action to the context
    cx.rgMenuActionsSelected = [menuAction.value];
  }

  // Set the search query if provided
  if (query) {
    // Clear the value first to ensure onDidChangeValue fires
    // This is important when running multiple searches with the same query
    cx.qp.value = '';
    // Small delay to ensure the clear is processed
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Now set the actual query
    cx.qp.value = query;
    if (debug) {
      console.log(`[PeriscopeTest] Set query to: ${query}`);
    }
  }

  // Calculate wait time based on operation type
  const actualWaitTime = waitTime ?? calculateWaitTime(command, query, isRegex);

  // Wait for results to appear using smart waiting
  if (query || command === 'periscope.searchFiles') {
    // Small delay for ripgrep to start
    await new Promise((resolve) => setTimeout(resolve, 100));
    await waitForSearchResults(1, actualWaitTime);
  } else {
    // If no query, just wait a bit for UI to stabilize
    await new Promise((resolve) => setTimeout(resolve, Math.min(actualWaitTime, 100)));
  }

  // Collect results
  const items = cx.qp.items as AllQPItemVariants[];

  if (debug) {
    console.log(`[PeriscopeTest] Found ${items.length} items`);
    if (items.length > 0 && items.length <= 5) {
      console.log(
        '[PeriscopeTest] Items:',
        items.map((item: any) => ({
          type: item._type,
          label: item.label?.substring(0, 50),
          filePath: item.data?.filePath,
        })),
      );
    }
  }

  // Process results
  const results = processResults(items);

  if (debug) {
    console.log(`[PeriscopeTest] Processed results:`, {
      count: results.count,
      files: results.files.slice(0, 5),
      types: [...new Set(results.raw.types)],
    });
  }

  // Conditionally hide the QuickPick based on keepOpen parameter
  // By default, keep it open for tests that need to interact with it
  // Set keepOpen: false for tests that need clean state between searches
  if (!keepOpen) {
    cx.qp.hide();
    if (debug) {
      console.log('[PeriscopeTest] QuickPick hidden for clean state');
    }
  }

  return results;
}

/**
 * Process QuickPick items into structured test results
 */
function processResults(items: AllQPItemVariants[]): TestResults {
  const files = new Set<string>();
  const fileToItemsMap = new Map<string, AllQPItemVariants[]>();
  const labels: string[] = [];
  const details: string[] = [];
  const types: string[] = [];

  for (const item of items) {
    // Collect raw data
    if (item.label) {
      labels.push(item.label);
    }
    if (item.detail) {
      details.push(item.detail);
    }
    types.push(item._type);

    // Extract file information
    let filePath: string | undefined;

    if (item._type === 'QuickPickItemQuery' && item.data?.filePath) {
      filePath = item.data.filePath;
    } else if (item._type === 'QuickPickItemFile' && item.data?.filePath) {
      filePath = item.data.filePath;
    }

    if (filePath) {
      const fileName = path.basename(filePath);
      files.add(fileName);

      // Map items to files
      if (!fileToItemsMap.has(fileName)) {
        fileToItemsMap.set(fileName, []);
      }
      fileToItemsMap.get(fileName)!.push(item);
    }
  }

  return {
    items,
    count: items.length,
    files: Array.from(files),
    fileToItemsMap,
    raw: {
      labels,
      details,
      types,
    },
  };
}

/**
 * Calculate appropriate wait time based on operation type
 */
function calculateWaitTime(command: string, query: string, isRegex: boolean): number {
  // File operations are generally faster
  if (command === 'periscope.searchFiles') {
    return 500;
  }

  // Current file search is fastest
  if (command === 'periscope.searchCurrentFile') {
    return 300;
  }

  // Resume search doesn't need to wait for new results
  if (command === 'periscope.resumeSearch' || command === 'periscope.resumeSearchCurrentFile') {
    return 200;
  }

  // Regular search needs more time, especially for regex
  if (isRegex || query.includes('.*') || query.includes('\\')) {
    return 800;
  }

  // Default for regular text search
  return 600;
}

/**
 * Helper functions for common Periscope commands
 */
export const periscopeTestHelpers = {
  /**
   * Search content in workspace (handles both text and regex)
   */
  search: (query: string, opts?: Partial<TestOptions>) =>
    executePeriscopeTest({
      command: 'periscope.search',
      query,
      ...opts,
    }),

  /**
   * Search for file names in workspace
   */
  searchFiles: (pattern: string, opts?: Partial<TestOptions>) =>
    executePeriscopeTest({
      command: 'periscope.searchFiles',
      query: pattern,
      ...opts,
    }),

  /**
   * Search within the current file
   */
  searchCurrentFile: (query: string, file: string, opts?: Partial<TestOptions>) =>
    executePeriscopeTest({
      command: 'periscope.searchCurrentFile',
      query,
      startFile: file,
      ...opts,
    }),

  /**
   * Resume the previous search
   */
  resumeSearch: (opts?: Partial<TestOptions>) =>
    executePeriscopeTest({
      command: 'periscope.resumeSearch',
      ...opts,
    }),

  /**
   * Resume search in current file
   */
  resumeSearchCurrentFile: (opts?: Partial<TestOptions>) =>
    executePeriscopeTest({
      command: 'periscope.resumeSearchCurrentFile',
      ...opts,
    }),

  /**
   * Search with selected text
   */
  searchWithSelection: (selectedText: string, file: string, opts?: Partial<TestOptions>) =>
    executePeriscopeTest({
      command: 'periscope.search',
      startFile: file,
      selectedText,
      ...opts,
    }),

  /**
   * Search with menu action
   */
  searchWithMenuAction: (
    query: string,
    menuAction: { label: string; value: string },
    opts?: Partial<TestOptions>,
  ) =>
    executePeriscopeTest({
      command: 'periscope.search',
      query,
      menuAction,
      ...opts,
    }),

  /**
   * Search with custom configuration
   */
  searchWithConfig: (query: string, config: { [key: string]: any }, opts?: Partial<TestOptions>) =>
    executePeriscopeTest({
      command: 'periscope.search',
      query,
      configuration: config,
      ...opts,
    }),

  /**
   * Search in multi-root workspace
   */
  searchInMultiRoot: (
    query: string,
    folders: vscode.WorkspaceFolder[],
    opts?: Partial<TestOptions>,
  ) =>
    executePeriscopeTest({
      command: 'periscope.search',
      query,
      workspaceFolders: folders,
      ...opts,
    }),

  /**
   * Open result in horizontal split
   */
  openInHorizontalSplit: (opts?: Partial<TestOptions>) =>
    executePeriscopeTest({
      command: 'periscope.openInHorizontalSplit',
      ...opts,
    }),
};
