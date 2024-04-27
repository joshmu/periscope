import * as vscode from 'vscode';
import { AllQPItemVariants, DisposablesMap } from '../types';
import { getConfig } from '../utils/getConfig';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { initHighlightLineInstance } from '../utils/highlightLineDecorationType';

// simple context for each invoke of periscope search
let qp = vscode.window.createQuickPick<AllQPItemVariants>(); // @see https://code.visualstudio.com/api/references/vscode-api#QuickPick
let workspaceFolders = vscode.workspace.workspaceFolders;
let previousActiveEditor = vscode.window.activeTextEditor;
let query = '';
let spawnRegistry: ChildProcessWithoutNullStreams[] = [];
let config = getConfig();
let rgMenuActionsSelected: string[] = [];
let highlightDecoration = initHighlightLineInstance();
let disposables: DisposablesMap = {
  general: [],
  rgMenuActions: [],
  query: [],
};
let appState = updateAppState('IDLE');

export const context = {
  resetContext,
  qp,
  workspaceFolders,
  previousActiveEditor,
  query,
  spawnRegistry,
  config,
  rgMenuActionsSelected,
  highlightDecoration,
  disposables,
  appState 
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
  context.highlightDecoration = initHighlightLineInstance();
  context.disposables = {
    general: [],
    rgMenuActions: [],
    query: [],
  };
}

type AppState = 'IDLE' | 'SEARCHING' | 'FINISHED';
export function updateAppState(state: AppState) {
  if (context?.appState) {context.appState = state;}
  return state;
}