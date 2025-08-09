import * as vscode from 'vscode';
import * as path from 'path';
import { context as cx } from '../../src/lib/context';
import { AllQPItemVariants } from '../../src/types';

export interface TestOptions {
  command?: string;
  query?: string;
  startFile?: string;
  position?: { line: number; character: number };
  waitTime?: number;
  isRegex?: boolean;
  debug?: boolean;
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

    if (debug) {
      console.log(`[PeriscopeTest] Opened file: ${filePath}`);
    }
  }

  // Execute the command
  await vscode.commands.executeCommand(command);

  // Wait for QuickPick to be ready
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (!cx.qp) {
    throw new Error('QuickPick not initialized after command execution');
  }

  if (debug) {
    console.log('[PeriscopeTest] QuickPick active:', cx.qp !== undefined);
    console.log('[PeriscopeTest] Initial QuickPick title:', cx.qp.title);
  }

  // Set the search query if provided
  if (query) {
    cx.qp.value = query;
    if (debug) {
      console.log(`[PeriscopeTest] Set query to: ${query}`);
    }
  }

  // Calculate wait time based on operation type
  const actualWaitTime = waitTime ?? calculateWaitTime(command, query, isRegex);
  await new Promise((resolve) => setTimeout(resolve, actualWaitTime));

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
  if (command === 'periscope.resumeSearch') {
    return 200;
  }

  // Regular search needs more time, especially for regex
  if (isRegex || query.includes('.*') || query.includes('\\')) {
    return 2500;
  }

  // Default for regular text search
  return 2000;
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
};
