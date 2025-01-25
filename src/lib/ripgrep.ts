import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { getConfig } from '../utils/getConfig';
import { context as cx, updateAppState } from './context';
import { tryJsonParse } from '../utils/jsonUtils';
import { QPItemQuery, RgLine } from '../types';
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

  const normalizedQuery = handleSearchTermWithAdditionalRgParams(value);

  return `"${rgPath}" ${normalizedQuery} ${rgFlags.join(' ')}`;
}

/**
 * Support for passing raw ripgrep queries by detection of a search_term within quotes within the input query
 * if found we can assume the rest of the query are additional ripgrep parameters
 */
function handleSearchTermWithAdditionalRgParams(query: string): string {
  const valueWithinQuotes = /".*?"/.exec(query);
  if (valueWithinQuotes) {
    return query;
  }
  return `"${query}"`;
}

export function rgSearch(value: string, rgExtraFlags?: string[]) {
  updateAppState('SEARCHING');
  cx.qp.busy = true;
  const rgCmd = getRgCommand(value, rgExtraFlags);
  log('rgCmd:', rgCmd);
  checkKillProcess();
  const searchResults: ReturnType<typeof normaliseRgResult>[] = [];

  const spawnProcess = spawn(rgCmd, [], { shell: true });
  cx.spawnRegistry.push(spawnProcess);

  spawnProcess.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);

    lines.forEach((line) => {
      const parsedLine = tryJsonParse<RgLine>(line);

      if (parsedLine?.type === 'match') {
        searchResults.push(normaliseRgResult(parsedLine));
      }
    });
  });

  spawnProcess.stderr.on('data', (data: Buffer) => {
    const errorMsg = data.toString();

    // additional UI feedback for common errors
    if (errorMsg.includes('unrecognized')) {
      cx.qp.title = errorMsg;
    }

    log.error(data.toString());
    handleNoResultsFound();
  });

  spawnProcess.on('exit', (code: number) => {
    /**
     * we need to additionally check 'SEARCHING' state as the user might have cancelled the search
     * but the process may still be running (eg: go back to the rg menu actions view)
     */
    if (code === 0 && searchResults.length && cx.appState === 'SEARCHING') {
      cx.qp.items = searchResults
        .map((searchResult) => {
          // break the filename via regext ':line:col:'
          const { filePath, linePos, colPos, textResult } = searchResult;

          // if all data is not available then remove the item
          if (!filePath || !linePos || !colPos || !textResult) {
            return false;
          }

          return createResultItem(filePath, textResult, linePos, colPos, searchResult);
        })
        .filter(Boolean) as QPItemQuery[];
    } else if (code === null || code === 0) {
      // do nothing if no code provided or process is success but nothing needs to be done
      log('Nothing to do...');
      return;
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
  });
}

function normaliseRgResult(parsedLine: RgLine) {
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
  };
}

export function checkKillProcess() {
  const { spawnRegistry } = cx;
  spawnRegistry.forEach((spawnProcess) => {
    spawnProcess.stdout.destroy();
    spawnProcess.stderr.destroy();
    spawnProcess.kill();
  });

  // check if spawn process is no longer running and if so remove from registry
  cx.spawnRegistry = spawnRegistry.filter((spawnProcess) => !spawnProcess.killed);
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
function ensureQuotedPath(path: string): string {
  // support for paths already quoted via config
  if (path.startsWith('"') && path.endsWith('"')) {
    return path;
  }
  // else quote the path
  return `"${path}"`;
}
