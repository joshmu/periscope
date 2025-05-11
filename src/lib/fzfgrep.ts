import { rgPath as vscodeRgPath } from '@vscode/ripgrep';
import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { getConfig } from '../utils/getConfig';
import { context as cx, updateAppState } from './context';
import { QPItemQuery, RgLine, FzfLine } from '../types';
import { log, notifyError } from '../utils/log';
import { createResultItemFile } from '../utils/quickpickUtils';
import { handleNoResultsFound } from './editorActions';
import { checkKillProcess, ensureQuotedPath } from './ripgrep';

// grab the bundled ripgrep binary from vscode
function ripgrepPath(optionsPath?: string) {
  if (optionsPath?.trim()) {
    return optionsPath.trim();
  }

  return vscodeRgPath;
}

function getFzfCommand(value: string, extraFlags?: string[]) {
  const config = getConfig();
  const { workspaceFolders } = vscode.workspace;

  const rgPath = ripgrepPath(config.rgPath);

  const rgRequiredFlags = [
    '--line-number',
    '--column',
    '--no-heading',
    '--with-filename',
    '--color=never',
    '--files',
    '--follow',
    '--no-ignore',
    '--hidden',
  ];
  const fzfRequiredFlags = ['-i', '--filter'];

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

  const fzfFlags = [...fzfRequiredFlags];

  const normalizedQuery = handleSearchTermWithCursorPositions(value);
  const workspaceFolder = rootPaths[0];
  const sedCmd = `| sed 's|${workspaceFolder}/||'`;

  return `"${rgPath}" "" ${rgFlags.join(' ')} ${sedCmd} | fzf ${fzfFlags.join(' ')} ${normalizedQuery}`;
}

/**
 * Support for passing a filename with line and column numbers, like /path/file.js:10:11
 */
function handleSearchTermWithCursorPositions(query: string): string {
  const valuePath = /^[^:]+/.exec(query);

  if (valuePath) return valuePath[0];
  return `"${query}"`;
}

function extractLineAndColPos(query: string): { linePos: number; colPos: number } {
  const matches = query.match(/(?::(\d+))/g)?.map((match) => match.replace(':', ''));
  const linePos = matches?.[0] ? parseInt(matches[0], 10) : 0;
  const colPos = matches?.[1] ? parseInt(matches[1], 10) : 0;

  return {
    linePos,
    colPos,
  };
}

export function fzfSearch(value: string, rgExtraFlags?: string[]) {
  updateAppState('SEARCHING');
  cx.qp.busy = true;
  const rgCmd = getFzfCommand(value, rgExtraFlags);
  const curPosition = extractLineAndColPos(value);
  log('rgCmd:', rgCmd);
  checkKillProcess();
  const searchResults: ReturnType<typeof normaliseRgResult>[] = [];

  const spawnProcess = spawn(rgCmd, [], { shell: true });
  cx.spawnRegistry.push(spawnProcess);

  const { workspaceFolders } = vscode.workspace;
  const rootPaths = workspaceFolders ? workspaceFolders.map((folder) => folder.uri.fsPath) : [];
  const workspaceFolder = rootPaths[0];

  // Capture stdout
  spawnProcess.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);

    lines.forEach((line) => {
      const parsedLine: FzfLine = {
        data: {
          path: {
            text: `${workspaceFolder}/${line}`,
          },
          line_pos: curPosition.linePos,
          col_pos: curPosition.colPos,
        },
      };

      searchResults.push(normaliseFzfResult(parsedLine));
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
          if (!filePath || !textResult) {
            return false;
          }

          return createResultItemFile(filePath, textResult, linePos, colPos, searchResult);
        })
        .filter(Boolean) as QPItemQuery[];
    } else if (code === null || code === 0) {
      // do nothing if no code provided or process is success but nothing needs to be done
      log('Nothing to do...');
      return;
    } else if (code === 1) {
      log(`Ripgrep exited with code ${code} (no results found)`);
      handleNoResultsFound();
    } else if (code === 2) {
      log.error(`Ripgrep exited with code ${code} (error during search operation)`);
    } else {
      const msg = `PERISCOPE exited with code ${code}`;
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

function normaliseFzfResult(parsedLine: FzfLine) {
  // eslint-disable-next-line camelcase, @typescript-eslint/naming-convention
  const { path } = parsedLine.data;
  const filePath = path.text;
  // eslint-disable-next-line camelcase
  const linePos = parsedLine.data.line_pos;
  const colPos = parsedLine.data.col_pos;
  const textResult = filePath.trim();

  return {
    filePath,
    linePos,
    colPos,
    textResult,
  };
}
