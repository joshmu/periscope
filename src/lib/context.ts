import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { AllQPItemVariants, DisposablesMap, SearchMode } from '../types';
import { getConfig } from '../utils/getConfig';
import { createPeekDecorationManager } from '../utils/createPeekDecorationManager';

// simple context for each invoke of periscope search
// @see https://code.visualstudio.com/api/references/vscode-api#QuickPick
const qp = vscode.window.createQuickPick<AllQPItemVariants>();
const { workspaceFolders } = vscode.workspace;
const previousActiveEditor = vscode.window.activeTextEditor;
const query = '';
const spawnRegistry: ChildProcessWithoutNullStreams[] = [];
const config = getConfig();
const rgMenuActionsSelected: string[] = [];
const matchDecoration = createPeekDecorationManager();
const disposables: DisposablesMap = {
  general: [],
  rgMenuActions: [],
  query: [],
};
const appState = updateAppState('IDLE');

export const context = {
  resetContext,
  qp,
  workspaceFolders,
  previousActiveEditor,
  query,
  spawnRegistry,
  config,
  rgMenuActionsSelected,
  matchDecoration,
  disposables,
  appState,
  /**
   * Search mode for the current operation
   */
  searchMode: 'all' as SearchMode,
  /**
   * Extension context for storage operations
   */
  extensionContext: undefined as vscode.ExtensionContext | undefined,
  /**
   * Last executed ripgrep command (for debugging)
   */
  lastRgCommand: undefined as string | undefined,
  /**
   * Injected ripgrep flags from command arguments
   */
  injectedRgFlags: [] as string[],
};

// reset the context
function resetContext() {
  context.qp = vscode.window.createQuickPick<AllQPItemVariants>();
  context.workspaceFolders = vscode.workspace.workspaceFolders;
  context.previousActiveEditor = vscode.window.activeTextEditor;
  context.query = '';
  context.spawnRegistry = [];
  context.config = getConfig();
  context.rgMenuActionsSelected = [];
  context.matchDecoration = createPeekDecorationManager();
  context.disposables = {
    general: [],
    rgMenuActions: [],
    query: [],
  };
  context.searchMode = 'all';
  context.injectedRgFlags = [];
  // Keep 'extensionContext' across resets to preserve search history
}

type AppState = 'IDLE' | 'SEARCHING' | 'FINISHED';
export function updateAppState(state: AppState) {
  if (context?.appState) {
    context.appState = state;
  }
  return state;
}
