import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs';

interface QuickPickItemCustom extends vscode.QuickPickItem {
  // custom payload
  data: {
    filePath: string
    relativePath: string
    linePos: number
    rawResult: string
  }
}

export class Periscope {
  activeEditor: vscode.TextEditor | undefined;
  quickPick: vscode.QuickPick<vscode.QuickPickItem | QuickPickItemCustom>;
  workspaceFolder: vscode.WorkspaceFolder | undefined;
  rootPath: string;

  constructor() {
    console.log('Periscope instantiated');
    this.activeEditor = vscode.window.activeTextEditor;
    this.quickPick = vscode.window.createQuickPick();
    this.workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    this.rootPath = this.workspaceFolder?.uri.fsPath || '';
  }

  public async register() {
    this.quickPick.placeholder = 'Enter a search query';
    this.quickPick.canSelectMany = false;
    this.onDidChangeValue();
    this.onDidChangeActive();
    this.onDidAccept();
    this.onDidHide();
    this.quickPick.show();
  }

  // when input query 'CHANGES'
  private onDidChangeValue() {
    this.quickPick.onDidChangeValue(value => {
      if (value) {
        // todo: swap out search engine
        this.search(value);
      } else {
        this.quickPick.items = [];
      }
    });
  }

  // when item is 'FOCUSSED'
  private onDidChangeActive() {
    this.quickPick.onDidChangeActive(items => {
      this.peekItem(items as readonly QuickPickItemCustom[]);
    });
  }

  // when item is 'SELECTED'
  private onDidAccept() {
    this.quickPick.onDidAccept(() => {
      this.accept();
    });
  }

  // when prompt is 'CANCELLED'
  private onDidHide() {
    this.quickPick.onDidHide(() => {
      if (!this.quickPick.selectedItems[0]) {
        if (this.activeEditor) {
          vscode.window.showTextDocument(
            this.activeEditor.document,
            this.activeEditor.viewColumn
          );
        }
      }
    });
  }

  private search(value: string) {
    const ignoreFile = path.join(this.rootPath, '.gitignore');
    let excludes: string[] = [];
    if (fs.existsSync(ignoreFile)) {
      // const ignorePatterns = fs
      //   .readFileSync(ignoreFile)
      //   .toString()
      //   .split('\n')
      //   .filter(Boolean);

      const ignorePatterns = [
        'node_modules',
        '.git',
        '.next',
        '.vercel',
        'dist',
        'out',
        'yarn.lock',
      ];

      excludes = ignorePatterns.map(pattern => `--glob !${pattern}`);
    }

    const rgCmd = `rg -n '${value}' --no-ignore --hidden -S "${
      this.rootPath
    }" ${excludes.join(' ')}`;
    const rgProc = spawn(rgCmd, [], { shell: true });
    let searchResultLines: string[] = [];
    rgProc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      searchResultLines = [...searchResultLines, ...lines];
    });
    rgProc.stderr.on('data', (data: Buffer) => {
      console.error(data.toString());
    });
    rgProc.on('exit', (code: number) => {
      if (code === 0 && searchResultLines.length) {
        this.quickPick.items = searchResultLines.map(searchResult => {
          // break the filename via regext ':number:'
          const [filePath, linePos, fileContents] = searchResult.split(':');
          return this.createResultItem(
            filePath,
            fileContents,
            parseInt(linePos)
          );
        });
      } else if (code === 1) {
        console.error(`rg error with code ${code}`);
      } else if (code === 2) {
        vscode.window.showErrorMessage('No matches found');
      } else {
        vscode.window.showErrorMessage(`Ripgrep exited with code ${code}`);
      }
    });
  }

  private peekItem(items: readonly QuickPickItemCustom[]) {
    if (items.length > 0) {
      const currentItem = items[0];
      const { filePath, linePos } = currentItem.data;
      vscode.workspace.openTextDocument(filePath).then(document => {
        vscode.window
          .showTextDocument(document, {
            preview: true,
            preserveFocus: true,
          })
          .then(editor => {
            this.setPos(editor, linePos);
          });
      });
    }
  }

  private accept() {
    const { filePath, linePos } = (
      this.quickPick.selectedItems[0] as QuickPickItemCustom
    ).data;
    vscode.workspace.openTextDocument(filePath).then(document => {
      vscode.window.showTextDocument(document).then(editor => {
        this.setPos(editor, linePos);
        this.quickPick.dispose();
      });
    });
  }

  // set cursor & view position
  private setPos(editor: vscode.TextEditor, linePos: number) {
    const selection = new vscode.Selection(0, 0, 0, 0);
    editor.selection = selection;

    const lineNumber = linePos ? linePos - 1 : 0;

    editor
      .edit(editBuilder => {
        editBuilder.insert(selection.active, '');
      })
      .then(() => {
        const character = selection.active.character;
        const newPosition = new vscode.Position(lineNumber, character);
        const range = editor.document.lineAt(newPosition).range;
        editor.selection = new vscode.Selection(newPosition, newPosition);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      });
  }

  // required to update the quick pick item with result information
  private createResultItem(
    filePath: string,
    fileContents: string,
    linePos: number,
    rawResult?: string
  ): QuickPickItemCustom {
    const relativePath = path.relative(this.rootPath, filePath);
    const folders = relativePath.split(path.sep);

    // abbreviate path if too long
    if (folders.length > 2) {
      folders.splice(0, folders.length - 2);
      folders.unshift('...');
    }

    return {
      label: fileContents.trim(),
      data: {
        filePath,
        relativePath,
        linePos,
        rawResult: rawResult ?? '',
      },
      description: `${folders.join(path.sep)}`,
      // detail: `${folders.join(path.sep)}`,
    };
  }
}
