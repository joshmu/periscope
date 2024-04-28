import * as vscode from 'vscode';

const PREFIX = 'PERISCOPE:';

export function log(...args: unknown[]) {
  console.log(PREFIX, ...args);
}

log.error = function error(...args: unknown[]) {
  console.error(PREFIX, ...args);
};

// Notify the user of an error
export function notifyError<T extends string>(msg: string, ...items: T[]) {
  return vscode.window.showErrorMessage<T>(`${PREFIX} ${msg}`, ...items);
}
