import * as vscode from 'vscode';
import { log } from '../utils/log';

const STORAGE_KEY = 'periscope.searchHistory';
const MAX_HISTORY_SIZE = 10;

interface StoredQuery {
  query: string;
  timestamp: number;
}

// In-memory fallback storage
let inMemoryHistory: StoredQuery[] = [];

export function saveQuery(
  extensionContext: vscode.ExtensionContext | undefined,
  query: string,
): void {
  if (!query.trim()) {
    return;
  }

  const storedQuery: StoredQuery = {
    query,
    timestamp: Date.now(),
  };

  try {
    if (extensionContext) {
      // Get existing history
      const history = extensionContext.workspaceState.get<StoredQuery[]>(STORAGE_KEY, []);

      // Add new query to the front
      history.unshift(storedQuery);

      // Limit history size
      if (history.length > MAX_HISTORY_SIZE) {
        history.splice(MAX_HISTORY_SIZE);
      }

      // Save updated history
      extensionContext.workspaceState.update(STORAGE_KEY, history);
      log(`Saved query to workspace state history`);
    } else {
      // Fallback to in-memory storage
      inMemoryHistory.unshift(storedQuery);
      if (inMemoryHistory.length > MAX_HISTORY_SIZE) {
        inMemoryHistory.splice(MAX_HISTORY_SIZE);
      }
      log(`Saved query to in-memory history`);
    }
  } catch (error) {
    // Silent fallback to in-memory storage
    inMemoryHistory.unshift(storedQuery);
    if (inMemoryHistory.length > MAX_HISTORY_SIZE) {
      inMemoryHistory.splice(MAX_HISTORY_SIZE);
    }
    log(`Storage error, using in-memory fallback: ${error}`);
  }
}

export function getLastQuery(
  extensionContext: vscode.ExtensionContext | undefined,
): StoredQuery | undefined {
  try {
    if (extensionContext) {
      // Try to get from workspace state
      const history = extensionContext.workspaceState.get<StoredQuery[]>(STORAGE_KEY, []);
      if (history.length > 0) {
        log(`Retrieved query from workspace state history`);
        return history[0];
      }
    }

    // Check in-memory storage as fallback
    if (inMemoryHistory.length > 0) {
      log(`Retrieved query from in-memory history`);
      return inMemoryHistory[0];
    }
  } catch (error) {
    log(`Error retrieving query: ${error}`);
  }

  return undefined;
}
