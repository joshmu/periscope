import * as vscode from 'vscode';
import { AllQPItemVariants } from '../types';

// Allow other commands to access the QuickPick
export let activeQP : vscode.QuickPick<AllQPItemVariants> | undefined;

// Update the active QuickPick
export function updateActiveQP(qp: vscode.QuickPick<AllQPItemVariants> | undefined) {
    activeQP = qp;
}
