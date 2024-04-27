import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { getConfig } from "../utils/getConfig";
import { ripgrepPath } from "../utils/ripgrep";
import { context as cx } from './context';
import { tryJsonParse } from '../utils/jsonUtils';
import { QPItemQuery, RgLine } from '../types';
import { log, notifyError } from '../utils/log';
import { createResultItem } from '../utils/quickpickUtils';
import { handleNoResultsFound } from './editorActions';
import { parse } from 'path';

export function rgCommand(value: string, extraFlags?: string[]) {
  let config = getConfig();
  let workspaceFolders = vscode.workspace.workspaceFolders;

  const rgPath = ripgrepPath(config.rgPath);

  const rgRequiredFlags = [
    '--line-number',
    '--column',
    '--no-heading',
    '--with-filename',
    '--color=never',
    '--json'
  ];

  const rootPaths = workspaceFolders
    ? workspaceFolders.map(folder => folder.uri.fsPath)
    : [];

  const excludes = config.rgGlobExcludes.map(exclude => {
    return `--glob "!${exclude}"`;
  });

  const rgFlags = [
    ...rgRequiredFlags,
    ...config.rgOptions,
    ...cx.rgMenuActionsSelected,
    ...rootPaths,
    ...config.addSrcPaths,
    ...(extraFlags || []),
    ...excludes,
  ];

  return `"${rgPath}" "${value}" ${rgFlags.join(' ')}`;
}

export function search(value: string, rgExtraFlags?: string[]) {
  cx.qp.busy = true;
  const rgCmd = rgCommand(value, rgExtraFlags);
  log('rgCmd:', rgCmd);
  checkKillProcess();
  let searchResults: any[] = [];

  const spawnProcess = spawn(rgCmd, [], { shell: true });
  cx.spawnRegistry.push(spawnProcess);
  
  spawnProcess.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);

    for (const line of lines) {
        const parsedLine = tryJsonParse<RgLine>(line);

        if (parsedLine?.type === 'match') {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const { path, lines, line_number } = parsedLine.data;
            const filePath = path.text;
            const linePos = line_number;
            const colPos = parsedLine.data.submatches[0].start + 1;
            const textResult = lines.text.trim();

            const resultItem = {
                filePath,
                linePos,
                colPos,
                textResult
            };
            searchResults.push(resultItem);
        }
    }
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
    if (code === 0 && searchResults.length) {
      cx.qp.items = searchResults
        .map(searchResult => {
          // break the filename via regext ':line:col:'
          const {filePath, linePos, colPos, textResult} = searchResult;

          // if all data is not available then remove the item
          if (!filePath || !linePos || !colPos || !textResult) {
            return false;
          }

          return createResultItem(
            filePath,
            textResult,
            parseInt(linePos),
            parseInt(colPos),
            searchResult
          );
        })
        .filter(Boolean) as QPItemQuery[];
    } else if (code === null || code === 0) {
      // do nothing if no code provided or process is success but nothing needs to be done
      log('Nothing to do...');
      return;
    } else if (code === 127) {
      notifyError(`PERISCOPE: Ripgrep exited with code ${code} (Ripgrep not found. Please install ripgrep)`);
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

export function checkKillProcess() {
  const {spawnRegistry} = cx;
  spawnRegistry.forEach(spawnProcess => {
    spawnProcess.stdout.destroy();
    spawnProcess.stderr.destroy();
    spawnProcess.kill();
  });

  // check if spawn process is no longer running and if so remove from registry
  cx.spawnRegistry = spawnRegistry.filter(spawnProcess => {
    return !spawnProcess.killed;
  });
}

// extract rg flags from the query, can match multiple regex's
export function extraRgFlagsFromQuery(query: string): {
  newQuery: string;
  extraRgFlags: string[];
} {
  const extraRgFlags: string[] = [];
  const queries = [query];

  for (const { param, regex } of cx.config.rgQueryParams) {
    if (param && regex) {
      const match = query.match(regex);
      if (match && match.length > 1) {
        let newParam = param;
        for (let i = 2; i < match.length; i++) {
          newParam = newParam.replace(`$${i-1}`, match[i]);
        }
        extraRgFlags.push(newParam);
        queries.push(match[1]);
      }
    }
  }

  // prefer the first query match or the original one
  const newQuery = queries.length > 1 ? queries[1] : queries[0];
  return { newQuery, extraRgFlags };
}
