import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { getConfig } from '../utils/getConfig';
import { context as cx, updateAppState } from './context';
import { tryJsonParse } from '../utils/jsonUtils';
import { QPItemQuery } from '../types';
import { RgMatchResult } from '../types/ripgrep';
import { log, notifyError } from '../utils/log';
import { createResultItem } from '../utils/quickpickUtils';
import { handleNoResultsFound } from './editorActions';

function getRgCommand(value: string, extraFlags?: string[]) {
  const config = getConfig();
  const { workspaceFolders } = vscode.workspace;

  const { rgPath } = config;

  const rgRequiredFlags = [
    '--line-number',
    '--column',
    '--no-heading',
    '--with-filename',
    '--color=never',
    '--json',
  ];

  const rootPaths = workspaceFolders ? workspaceFolders.map((folder) => folder.uri.fsPath) : [];

  const excludes = config.rgGlobExcludes.map((exclude) => `--glob "!${exclude}"`);

  const rgFlags = [
    ...rgRequiredFlags,
    ...config.rgOptions,
    ...cx.rgMenuActionsSelected,
    ...rootPaths,
    ...config.addSrcPaths.map(ensureQuotedPath),
    ...(extraFlags || []),
    ...excludes,
  ];

  // The 'value' here is the search term, possibly extracted by checkAndExtractRgFlagsFromQuery.
  // It needs to be appropriately quoted if it contains spaces and isn't already.
  const normalizedQuery = handleSearchTermWithAdditionalRgParams(value);

  return `"${rgPath}" ${normalizedQuery} ${rgFlags.join(' ')}`;
}

/**
 * Ensures the search term is properly quoted for the Ripgrep command.
 * If the query already contains a quoted substring (e.g., from user input like `"search term"` or
 * as a result of `checkAndExtractRgFlagsFromQuery`), it's returned as is.
 * Otherwise, if the query contains spaces, it's wrapped in quotes.
 * This is called by `getRgCommand` after any flag extraction.
 */
function handleSearchTermWithAdditionalRgParams(query: string): string {
  // Matches if the query is already a single quoted string or contains a quoted part.
  // Regex: ^".*"$ matches a string that is entirely quoted.
  // Regex: /".*?"/ matches if there's any quoted part within the string.
  // We are interested if the whole query *is* a single quoted term, or if it's a simple term without quotes.
  // If it's complex with quotes *and* other things, checkAndExtractRgFlagsFromQuery should have handled it.
  const isAlreadyQuoted = /^".*"$/.test(query.trim());

  if (isAlreadyQuoted || !query.includes(' ')) {
    // If already quoted OR doesn't contain spaces, it can be used as is.
    return query;
  }
  // If it contains spaces and is not already quoted, quote it.
  return `"${query}"`;
}

function spawnRipgrepProcess(
    return query;
  }
// No, the previous version of the regex was better: /".*?"/.exec(query)
// Let's revert that specific part of the change.
// The original logic was: if there's *any* quote pair, assume user knows what they are doing.
// Otherwise, quote the whole thing if it has spaces.
// This is safer.
// Reverting the regex logic in handleSearchTermWithAdditionalRgParams

// Corrected version after self-correction:
/**
 * Ensures the search term is properly quoted for the Ripgrep command.
 * If the query string already contains a quoted part (e.g., user typed `"my term" -flag`),
 * this function assumes the quoting is intentional and returns the query as is.
 * Otherwise, if the query contains spaces (e.g., `my term`), it wraps the entire query in quotes
 * (e.g., `"my term"`) to ensure it's treated as a single argument by Ripgrep.
 * This function is typically called by `getRgCommand` with the search term that may have been
 * extracted by `checkAndExtractRgFlagsFromQuery`.
 */
function handleSearchTermWithAdditionalRgParams(query: string): string {
  const valueWithinQuotes = /".*?"/.exec(query);
  if (valueWithinQuotes) {
    // If there's any quoted substring, assume user is handling quoting,
    // or checkAndExtractRgFlagsFromQuery has already produced a quoted part.
    return query;
  }
  // If no part of the query is quoted and it contains spaces, quote the whole query.
  if (query.includes(' ')) {
    return `"${query}"`;
  }
  // Otherwise (no spaces, or no quotes needed), return as is.
  return query;
}

function spawnRipgrepProcess(
  rgCmd: string,
  onStdout: (data: string) => void,
  onStderr: (data: string) => void,
  onExit: (code: number | null) => void,
): ChildProcess {
  const spawnProcess = spawn(rgCmd, [], { shell: true });
  cx.spawnRegistry.push(spawnProcess);

  spawnProcess.stdout.on('data', (data: Buffer) => onStdout(data.toString()));
  spawnProcess.stderr.on('data', (data: Buffer) => onStderr(data.toString()));
  spawnProcess.on('exit', (code: number | null) => onExit(code));

  return spawnProcess;
}

function processStdoutLine(line: string) {
  const parsedLine = tryJsonParse<RgMatchResult['rawResult']>(line);

  if (parsedLine?.type === 'match') {
    const searchResult = normaliseRgResult(parsedLine);
    const { filePath, linePos, colPos, textResult } = searchResult;

    if (!filePath || !linePos || !colPos || !textResult) {
      // Invalid data, skip
      return;
    }
    const qpItem = createResultItem(searchResult);
    if (qpItem) {
      // Add item to QuickPick. Consider batching if UI is laggy.
      cx.qp.items = [...cx.qp.items, qpItem];
    }
  } else if (parsedLine?.type === 'begin') {
    // A file search has begun. Log or handle if necessary.
    log('Ripgrep processing file:', parsedLine.data.path?.text);
  } else if (parsedLine?.type === 'end') {
    // A file search has ended. Log or handle if necessary.
    log('Ripgrep finished processing file:', parsedLine.data.path?.text, `Binary: ${parsedLine.data.binary}`);
    // Potentially update UI to show progress, e.g. files scanned
  }
  // Other types like 'summary' could be logged too if needed.
}

function processStderr(errorMsg: string) {
  log.error(errorMsg);

  if (errorMsg.includes('ENOENT') || errorMsg.includes('code 127')) {
    const userFriendlyMessage = 'Ripgrep not found. Please ensure ripgrep is installed and in your PATH.';
    notifyError(`PERISCOPE: ${userFriendlyMessage}`);
    cx.qp.title = userFriendlyMessage;
    handleNoResultsFound();
  } else if (errorMsg.includes('unrecognized argument')) {
    cx.qp.title = `Error: ${errorMsg}`;
    handleNoResultsFound();
  } else {
    // For other errors, just log and update title if it seems relevant
    // cx.qp.title = 'Ripgrep error occurred'; // Avoid overly generic messages
    handleNoResultsFound(); // Assuming most stderr outputs mean no usable results
  }
}

function handleRipgrepExit(code: number | null) {
  // Results are now streamed directly to cx.qp.items.
  // This function finalizes the state.
  if (code === 0 && cx.appState === 'SEARCHING') {
    if (cx.qp.items.length === 0) {
      log('Ripgrep exited successfully, no matches found.');
      handleNoResultsFound();
    } else {
      log('Ripgrep exited successfully, results were streamed.');
      // cx.qp.items is already populated.
    }
  } else if (code === null && cx.appState !== 'SEARCHING') {
    // Process was likely cancelled by user (e.g. closing quickpick or new search started)
    log('Ripgrep process was cancelled or exited early (spawn `code` is null and no longer in SEARCHING state).');
  } else if (code === null || code === 0) {
    // Catch-all for successful exit or null code when still in SEARCHING state (less common)
    log('Ripgrep process exited (code null or 0), ensuring UI reflects final state.');
    if (cx.appState === 'SEARCHING' && cx.qp.items.length === 0) {
      handleNoResultsFound();
    }
  } else if (code === 1) {
    log(`Ripgrep exited with code ${code} (no results found by Ripgrep, or an issue occurred that rg treats as 'no match').`);
    // If cx.qp.items has items, it means we streamed some results before rg exited with 1.
    // This can happen if rg searches multiple paths and one has an issue.
    // However, rg exiting with 1 usually means "no results found globally".
    // If items are present, we trust what was streamed. Otherwise, declare "no results".
    if (cx.qp.items.length === 0) {
      handleNoResultsFound();
    }
  } else if (code === 127) { // Should be caught by stderr handling, but as a fallback
    const userFriendlyMessage = 'Ripgrep not found. Please ensure ripgrep is installed and in your PATH.';
    notifyError(`PERISCOPE: ${userFriendlyMessage} (exit code ${code})`);
    cx.qp.title = userFriendlyMessage;
    handleNoResultsFound();
  } else if (code === 2) {
    log.error(`Ripgrep exited with code ${code} (error during search operation)`);
    notifyError(`PERISCOPE: Ripgrep error (code ${code}). Check logs.`);
    handleNoResultsFound();
  } else {
    const msg = `Ripgrep exited with code ${code}`;
    log.error(msg);
    notifyError(`PERISCOPE: ${msg}`);
    handleNoResultsFound();
  }
  cx.qp.busy = false;
}

export function rgSearch(value: string, rgExtraFlags?: string[]) {
  updateAppState('SEARCHING');
  cx.qp.busy = true;
  cx.qp.items = []; // Clear previous results immediately for streaming
  const rgCmd = getRgCommand(value, rgExtraFlags);
  log('rgCmd:', rgCmd);
  checkKillProcess();
  // searchResults array is no longer the primary source for QuickPick items.
  // It could be used for logging or final counting if needed, but for now, it's unused.
  // const searchResults: RgMatchResult[] = [];

  const onStdoutData = (data: string) => {
    const lines = data.split('\n').filter(Boolean);
    lines.forEach((line) => {
      // Removed passing searchResults, processStdoutLine now directly updates cx.qp.items
      processStdoutLine(line);
    });
  };

  const onStderrData = (data: string) => {
    processStderr(data);
  };

  const onExit = (code: number | null) => {
    // Removed passing searchResults
    handleRipgrepExit(code);
  };

  spawnRipgrepProcess(rgCmd, onStdoutData, onStderrData, onExit);
}

function normaliseRgResult(parsedLine: RgMatchResult['rawResult']): RgMatchResult {
  // eslint-disable-next-line camelcase, @typescript-eslint/naming-convention
  const { path, lines, line_number } = parsedLine.data;
  const filePath = path.text;
  // eslint-disable-next-line camelcase
  const linePos = line_number;
  const colPos = parsedLine.data.submatches[0].start + 1;
  const textResult = lines.text.trim();

  return {
    filePath,
    linePos,
    colPos,
    textResult,
    rawResult: parsedLine,
  };
}

export function checkKillProcess() {
  const { spawnRegistry } = cx;
  if (spawnRegistry.length === 0) {
    return;
  }

  log(`Cleaning up ${spawnRegistry.length} Ripgrep process(es).`);

  spawnRegistry.forEach((spawnProcess) => {
    try {
      if (spawnProcess.stdout && !spawnProcess.stdout.destroyed) {
        spawnProcess.stdout.destroy();
      }
    } catch (e: any) {
      log.error(`Error destroying stdout for process ${spawnProcess.pid}: ${e.message}`);
    }

    try {
      if (spawnProcess.stderr && !spawnProcess.stderr.destroyed) {
        spawnProcess.stderr.destroy();
      }
    } catch (e: any) {
      log.error(`Error destroying stderr for process ${spawnProcess.pid}: ${e.message}`);
    }

    try {
      if (!spawnProcess.killed) {
        // Attempt graceful termination first.
        // For Ripgrep, SIGTERM (default) is usually sufficient.
        const killed = spawnProcess.kill(); // Sends SIGTERM by default
        if (killed) {
          log(`Successfully sent kill signal to process ${spawnProcess.pid}.`);
        } else {
          log.error(`Failed to send kill signal to process ${spawnProcess.pid}. Process might already be dead or unkillable.`);
          // If kill() returns false, it means the signal could not be sent.
          // This could be because the process is already dead.
          // The .killed flag should reflect this eventually.
        }
      }
    } catch (e: any) {
      log.error(`Error killing process ${spawnProcess.pid}: ${e.message}. It might have already exited.`);
      // This catch is for errors during the .kill() call itself, e.g., if the process doesn't exist.
    }
  });

  // Filter out processes that are confirmed to be killed.
  // The .killed flag is set by Node.js internally when the process has actually terminated.
  // This might not be immediate after spawnProcess.kill() returns.
  // However, for cleanup, we rely on this flag.
  // If a process was killable, it should eventually be marked .killed.
  // If spawnProcess.kill() failed and it wasn't already dead, it might remain in the registry
  // if .killed isn't true yet. This is acceptable as this function is called periodically.
  const newSpawnRegistry = spawnRegistry.filter((spawnProcess) => {
    if (spawnProcess.killed) {
      log(`Process ${spawnProcess.pid} confirmed killed, removing from registry.`);
      return false; // Remove from registry
    }
    return true; // Keep in registry
  });

  if (newSpawnRegistry.length < spawnRegistry.length) {
    log(`Removed ${spawnRegistry.length - newSpawnRegistry.length} processes from registry. New registry size: ${newSpawnRegistry.length}`);
  }
  cx.spawnRegistry = newSpawnRegistry;
}

// extract rg flags from the query, can match multiple regex's
/**
 * Parses the raw user input string to separate it into a conceptual search query
 * and an array of additional Ripgrep flags.
 * It iterates through `cx.config.rgQueryParams` (regexes defined in settings)
 * to find patterns in the `userInput`.
 * If a regex matches, it extracts a part of the input as the `rgQuery` (search term)
 * and another part as `extraRgFlags`.
 * The returned `rgQuery` will be further processed by `handleSearchTermWithAdditionalRgParams`
 * to ensure correct quoting for the shell command.
 */
export function checkAndExtractRgFlagsFromQuery(userInput: string): {
  rgQuery: string;
  extraRgFlags: string[];
} {
  const extraRgFlags: string[] = [];
  const queries = [userInput];

  cx.config.rgQueryParams.forEach(({ param, regex }) => {
    if (param && regex) {
      const match = userInput.match(regex);
      if (match && match.length > 1) {
        let newParam = param;
        match.slice(2).forEach((value, index) => {
          newParam = newParam.replace(`$${index + 1}`, value);
        });
        extraRgFlags.push(newParam);
        queries.push(match[1]);
      }
    }
  });

  // prefer the first query match or the original one
  const rgQuery = queries.length > 1 ? queries[1] : queries[0];
  return { rgQuery, extraRgFlags };
}

/**
 * Ensure that the src path provided is quoted
 * Required when config paths contain whitespace
 */
function ensureQuotedPath(path: string): string {
  // support for paths already quoted via config
  if (path.startsWith('"') && path.endsWith('"')) {
    return path;
  }
  // else quote the path
  return `"${path}"`;
}
