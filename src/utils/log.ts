import * as vscode from 'vscode';

const PREFIX = 'PERISCOPE:';

// Lazy-initialized LogOutputChannel
let outputChannel: vscode.LogOutputChannel | undefined;

// Check if we're in test mode
function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VSCODE_TEST === 'true';
}

// Get or create the output channel
function getOutputChannel(): vscode.LogOutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Periscope', { log: true });
  }
  return outputChannel;
}

// Initialize the output channel (called from extension activation)
export function initializeOutputChannel(context: vscode.ExtensionContext): vscode.LogOutputChannel {
  const channel = getOutputChannel();
  context.subscriptions.push(channel);
  return channel;
}

// Helper function to format arguments into a message string
function formatMessage(args: unknown[]): string {
  return args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
}

// Generic logging function to reduce repetition
function logMessage(
  level: 'info' | 'error' | 'warn' | 'debug' | 'trace',
  consoleMethod: 'log' | 'error' | 'warn' | null,
  args: unknown[],
) {
  if (isTestMode()) {
    return;
  }

  const message = formatMessage(args);

  // Log to console for development (skip for trace, conditionally for debug)
  if (consoleMethod) {
    if (level === 'debug' && !process.env.DEBUG) {
      // Skip console logging for debug when DEBUG env is not set
    } else {
      const prefix = level === 'debug' ? [PREFIX, '[DEBUG]'] : [PREFIX];
      console[consoleMethod](...prefix, ...args);
    }
  }

  // Log to output channel
  if (outputChannel) {
    outputChannel[level](message);
  }
}

// Main log function
export function log(...args: unknown[]) {
  logMessage('info', 'log', args);
}

// Error logging
log.error = function error(...args: unknown[]) {
  logMessage('error', 'error', args);
};

// Debug logging
log.debug = function debug(...args: unknown[]) {
  logMessage('debug', 'log', args);
};

// Warning logging
log.warn = function warn(...args: unknown[]) {
  logMessage('warn', 'warn', args);
};

// Trace logging (console output disabled for trace)
log.trace = function trace(...args: unknown[]) {
  logMessage('trace', null, args);
};

// Notify the user of an error
export function notifyError<T extends string>(msg: string, ...items: T[]) {
  // Log the error (will handle test mode check internally)
  log.error(msg);
  return vscode.window.showErrorMessage<T>(`${PREFIX} ${msg}`, ...items);
}

// Export the output channel getter for external use if needed
export { getOutputChannel };
