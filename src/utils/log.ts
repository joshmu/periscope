import * as vscode from 'vscode';

const PREFIX = 'PERISCOPE:';

// Check if we're in test mode
function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VSCODE_TEST === 'true';
}

export function log(...args: unknown[]) {
  if (!isTestMode()) {
    console.log(PREFIX, ...args);
  }
}

log.error = function error(...args: unknown[]) {
  if (!isTestMode()) {
    console.error(PREFIX, ...args);
  }
};

// Notify the user of an error
export function notifyError<T extends string>(msg: string, ...items: T[]) {
  // Always show error messages, but only log to console in non-test mode
  if (!isTestMode()) {
    console.error(PREFIX, msg);
  }
  return vscode.window.showErrorMessage<T>(`${PREFIX} ${msg}`, ...items);
}
