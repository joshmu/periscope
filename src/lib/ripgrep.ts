import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { getConfig } from '../utils/getConfig';
import { context as cx, updateAppState } from './context';
import { tryJsonParse } from '../utils/jsonUtils';
import { QPItemFile, QPItemQuery } from '../types';
import { RgMatchResult } from '../types/ripgrep';
import { log, notifyError } from '../utils/log';
import { createResultItem, createFileItem } from '../utils/quickpickUtils';
import { handleNoResultsFound } from './editorActions';
import { getCurrentFilePath } from '../utils/searchCurrentFile';

function getRgCommand(value: string, extraFlags?: string[]) {
  const config = getConfig();
  const { workspaceFolders } = vscode.workspace;
  const { rgPath } = config;

  const rootPaths = workspaceFolders ? workspaceFolders.map((folder) => folder.uri.fsPath) : [];
  const paths = cx.searchMode === 'currentFile' ? [getCurrentFilePath()] : rootPaths;
  const excludes = config.rgGlobExcludes.map((exclude) => `--glob "!${exclude}"`);

  // Check if this is a file search (either from searchMode or injected flags)
  const isFileSearch = cx.searchMode === 'files' || cx.injectedRgFlags.includes('--files');

  // Common flags for both search modes
  const commonFlags = [
    ...cx.rgMenuActionsSelected,
    ...paths.filter((path): path is string => typeof path === 'string').map(ensureQuotedPath),
    ...config.addSrcPaths.map(ensureQuotedPath),
    ...excludes,
  ];

  let searchPattern = '';
  let modeSpecificFlags: string[];

  if (isFileSearch) {
    // File search mode - use --files flag and glob pattern
    const fileGlob = value ? `--glob "*${value}*"` : '';
    // Only add --files if it's not already in injectedRgFlags
    const filesFlag = cx.injectedRgFlags.includes('--files') ? [] : ['--files'];

    modeSpecificFlags = [
      ...filesFlag,
      ...cx.injectedRgFlags,
      fileGlob,
      ...config.rgOptions.filter((opt) => !opt.includes('--json')), // remove json flag if present
    ];
  } else {
    // Content search mode - use standard flags with search pattern
    searchPattern = handleSearchTermWithAdditionalRgParams(value);

    const rgRequiredFlags = [
      '--line-number',
      '--column',
      '--no-heading',
      '--with-filename',
      '--color=never',
      '--json',
    ];

    modeSpecificFlags = [
      ...rgRequiredFlags,
      ...config.rgOptions,
      ...cx.injectedRgFlags,
      ...(extraFlags || []),
    ];
  }

  const rgFlags = [...modeSpecificFlags, ...commonFlags].filter(Boolean);
  return `"${rgPath}" ${searchPattern} ${rgFlags.join(' ')}`.trim();
}

/**
 * Support for passing raw ripgrep queries by detection of a search_term within quotes within the input query
 * if found we can assume the rest of the query are additional ripgrep parameters
 */
export function handleSearchTermWithAdditionalRgParams(query: string): string {
  const valueWithinQuotes = /".*?"/.exec(query);
  if (valueWithinQuotes) {
    return query;
  }
  return `"${query}"`;
}

export function rgSearch(value: string, rgExtraFlags?: string[]) {
  performSearch(value, rgExtraFlags);
}

function performSearch(value: string, rgExtraFlags?: string[]) {
  updateAppState('SEARCHING');
  cx.qp.busy = true;

  const isFileSearch = cx.searchMode === 'files' || cx.injectedRgFlags.includes('--files');
  const rgCmd = getRgCommand(value, rgExtraFlags);

  log(isFileSearch ? 'rgCmd (files):' : 'rgCmd:', rgCmd);
  cx.lastRgCommand = rgCmd;
  checkKillProcess();

  // Storage for results based on search type
  const searchResults: RgMatchResult[] = [];
  const fileResults: string[] = [];

  const spawnProcess = spawn(rgCmd, [], { shell: true });
  cx.spawnRegistry.push(spawnProcess);

  spawnProcess.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);

    if (isFileSearch) {
      // File search - just collect file paths
      fileResults.push(...lines);
    } else {
      // Content search - parse JSON results
      lines.forEach((line) => {
        const parsedLine = tryJsonParse<RgMatchResult['rawResult']>(line);
        if (parsedLine?.type === 'match') {
          searchResults.push(normaliseRgResult(parsedLine));
        }
      });
    }
  });

  spawnProcess.stderr.on('data', (data: Buffer) => {
    handleRipgrepError(data);
  });

  spawnProcess.on('exit', (code: number) => {
    handleRipgrepExit(code, () => {
      if (isFileSearch) {
        processFileResults(fileResults);
      } else {
        processContentResults(searchResults);
      }
    });
  });
}

// Common error handler for ripgrep processes
function handleRipgrepError(data: Buffer) {
  const errorMsg = data.toString();

  if (errorMsg.includes('unrecognized')) {
    cx.qp.title = errorMsg;
  }

  log.error(errorMsg);
  handleNoResultsFound();
}

// Process file search results and update QuickPick items
function processFileResults(fileResults: string[]) {
  if (fileResults.length) {
    cx.qp.items = fileResults.map((filePath) => createFileItem(filePath.trim())) as QPItemFile[];
  }
}

// Process content search results and update QuickPick items
function processContentResults(searchResults: RgMatchResult[]) {
  if (searchResults.length) {
    cx.qp.items = searchResults
      .map((searchResult) => {
        const { filePath, linePos, colPos, textResult } = searchResult;

        // if all data is not available then remove the item
        if (!filePath || !linePos || !colPos || !textResult) {
          return false;
        }

        return createResultItem(searchResult);
      })
      .filter(Boolean) as QPItemQuery[];
  }
}

// Common exit handler for ripgrep processes
function handleRipgrepExit(code: number | null, onSuccess: () => void) {
  if (code === 0 && cx.appState === 'SEARCHING') {
    onSuccess();
  } else if (code === null || code === 0) {
    log('Nothing to do...');
  } else if (code === 127) {
    notifyError(
      `PERISCOPE: Ripgrep exited with code ${code} (Ripgrep not found. Please install ripgrep)`,
    );
  } else if (code === 1) {
    log(`Ripgrep exited with code ${code} (no results found)`);
    handleNoResultsFound();
  } else if (code === 2) {
    log.error(`Ripgrep exited with code ${code} (error during search operation)`);
  } else {
    const msg = `Ripgrep exited with code ${code}`;
    log.error(msg);
    notifyError(`PERISCOPE: ${msg}`);
  }
  cx.qp.busy = false;
}

export function normaliseRgResult(parsedLine: RgMatchResult['rawResult']): RgMatchResult {
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
  spawnRegistry.forEach((spawnProcess) => {
    if (!spawnProcess.killed) {
      // Check if the process is not already killed
      spawnProcess.stdout.destroy();
      spawnProcess.stderr.destroy();
      spawnProcess.kill();
    }
  });

  // Clear the registry after attempting to kill all processes
  cx.spawnRegistry = [];
}

// extract rg flags from the query, can match multiple regex's
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
export function ensureQuotedPath(path: string): string {
  // support for paths already quoted via config
  if (path.startsWith('"') && path.endsWith('"')) {
    return path;
  }
  // else quote the path
  return `"${path}"`;
}
