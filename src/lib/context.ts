import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { AllQPItemVariants, DisposablesMap } from '../types';
import { getConfig } from '../utils/getConfig';
import { initHighlightLineInstance } from '../utils/highlightLineDecorationType';

// simple context for each invoke of periscope search
// @see https://code.visualstudio.com/api/references/vscode-api#QuickPick
const qp = vscode.window.createQuickPick<AllQPItemVariants>();
const { workspaceFolders } = vscode.workspace;
const previousActiveEditor = vscode.window.activeTextEditor;
const query = '';
const spawnRegistry: ChildProcessWithoutNullStreams[] = [];
const config = getConfig();
const rgMenuActionsSelected: string[] = [];
const fzfMenuActionsSelected: string[] = [];
const highlightDecoration = initHighlightLineInstance();
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
  fzfMenuActionsSelected,
  highlightDecoration,
  disposables,
  appState,
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
  context.fzfMenuActionsSelected = [];
  context.highlightDecoration = initHighlightLineInstance();
  context.disposables = {
    general: [],
    rgMenuActions: [],
    query: [],
  };
}

type AppState = 'IDLE' | 'SEARCHING' | 'FINISHED';
export function updateAppState(state: AppState) {
  if (context?.appState) {
    context.appState = state;
  }
  return state;
}
