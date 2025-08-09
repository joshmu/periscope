import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { context as cx } from '../../lib/context';
import { checkAndExtractRgFlagsFromQuery, checkKillProcess, rgSearch } from '../../lib/ripgrep';

// Add dedicated test suite for checkAndExtractRgFlagsFromQuery
suite('checkAndExtractRgFlagsFromQuery', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    // Mock the config for each test
    sandbox.stub(cx, 'config').value({
      rgQueryParams: [
        {
          regex: '^(.+) -t ?(\\w+)$',
          param: '-t $1',
        },
        {
          regex: '^(.+) --type=(\\w+)$',
          param: '--type=$1',
        },
        {
          regex: '^(.+) -g ?"([^"]+)"$',
          param: '-g "$1"',
        },
      ],
    });
  });

  teardown(() => {
    sandbox.restore();
  });

  test('should handle simple type flag', () => {
    const { rgQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery('myquery -t js');
    assert.strictEqual(rgQuery, 'myquery');
    assert.deepStrictEqual(extraRgFlags, ['-t js']);
  });

  test('should handle long form type flag', () => {
    const { rgQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery('searchtext --type=rust');
    assert.strictEqual(rgQuery, 'searchtext');
    assert.deepStrictEqual(extraRgFlags, ['--type=rust']);
  });

  test('should handle glob pattern with quotes', () => {
    const { rgQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery('findme -g "*.{js,ts}"');
    assert.strictEqual(rgQuery, 'findme');
    assert.deepStrictEqual(extraRgFlags, ['-g "*.{js,ts}"']);
  });

  test('should return original query when no flags match', () => {
    const { rgQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery('plain search query');
    assert.strictEqual(rgQuery, 'plain search query');
    assert.deepStrictEqual(extraRgFlags, []);
  });

  test('should handle query with spaces', () => {
    const { rgQuery, extraRgFlags } = checkAndExtractRgFlagsFromQuery(
      'search with spaces -t python',
    );
    assert.strictEqual(rgQuery, 'search with spaces');
    assert.deepStrictEqual(extraRgFlags, ['-t python']);
  });
});

suite('checkKillProcess', () => {
  let sandbox: sinon.SinonSandbox;

  type MockProcess = {
    killed: boolean;
    kill: sinon.SinonSpy;
    stdout: { destroy: sinon.SinonSpy };
    stderr: { destroy: sinon.SinonSpy };
  };

  function createMockProcess(killedState: boolean): MockProcess {
    return {
      killed: killedState,
      kill: sinon.spy(),
      stdout: { destroy: sinon.spy() },
      stderr: { destroy: sinon.spy() },
    };
  }

  setup(() => {
    sandbox = sinon.createSandbox();
    cx.spawnRegistry = [];
  });

  teardown(() => {
    sandbox.restore();
    cx.spawnRegistry = [];
  });

  test('should do nothing if spawnRegistry is empty', () => {
    checkKillProcess();
    assert.deepStrictEqual(cx.spawnRegistry, []);
  });

  test('should kill a single active process and clear registry', () => {
    const mockProc = createMockProcess(false);
    cx.spawnRegistry.push(mockProc as any);

    checkKillProcess();

    sinon.assert.calledOnce(mockProc.kill);
    sinon.assert.calledOnce(mockProc.stdout.destroy);
    sinon.assert.calledOnce(mockProc.stderr.destroy);
    assert.deepStrictEqual(cx.spawnRegistry, []);
  });

  test('should kill multiple active processes and clear registry', () => {
    const mockProc1 = createMockProcess(false);
    const mockProc2 = createMockProcess(false);
    cx.spawnRegistry.push(mockProc1 as any, mockProc2 as any);

    checkKillProcess();

    sinon.assert.calledOnce(mockProc1.kill);
    sinon.assert.calledOnce(mockProc1.stdout.destroy);
    sinon.assert.calledOnce(mockProc1.stderr.destroy);

    sinon.assert.calledOnce(mockProc2.kill);
    sinon.assert.calledOnce(mockProc2.stdout.destroy);
    sinon.assert.calledOnce(mockProc2.stderr.destroy);

    assert.deepStrictEqual(cx.spawnRegistry, []);
  });

  test('should not attempt to kill an already killed process and clear registry', () => {
    const mockProc = createMockProcess(true);
    cx.spawnRegistry.push(mockProc as any);

    checkKillProcess();

    sinon.assert.notCalled(mockProc.kill);
    sinon.assert.notCalled(mockProc.stdout.destroy);
    sinon.assert.notCalled(mockProc.stderr.destroy);
    assert.deepStrictEqual(cx.spawnRegistry, []);
  });

  test('should handle a mix of active and killed processes and clear registry', () => {
    const activeProc = createMockProcess(false);
    const killedProc = createMockProcess(true);
    cx.spawnRegistry.push(activeProc as any, killedProc as any);

    checkKillProcess();

    // Assertions for the active process
    sinon.assert.calledOnce(activeProc.kill);
    sinon.assert.calledOnce(activeProc.stdout.destroy);
    sinon.assert.calledOnce(activeProc.stderr.destroy);

    // Assertions for the already killed process
    sinon.assert.notCalled(killedProc.kill);
    sinon.assert.notCalled(killedProc.stdout.destroy);
    sinon.assert.notCalled(killedProc.stderr.destroy);

    assert.deepStrictEqual(cx.spawnRegistry, []);
  });
});

suite('rgSearch - Path with Spaces Bug', () => {
  let sandbox: sinon.SinonSandbox;
  let spawnStub: sinon.SinonStub;

  setup(() => {
    sandbox = sinon.createSandbox();

    // Minimal mock spawn that just captures the command
    spawnStub = sandbox.stub(require('child_process'), 'spawn').returns({
      stdout: { on: sandbox.stub() },
      stderr: { on: sandbox.stub() },
      on: sandbox.stub(),
      killed: false,
    } as any);

    // Minimal required context
    cx.spawnRegistry = [];
    cx.qp = { busy: false } as any;

    // Minimal config mock
    sandbox.stub(require('../../utils/getConfig'), 'getConfig').returns({
      rgPath: 'rg',
      rgOptions: [],
      rgGlobExcludes: [],
      addSrcPaths: [],
    });
  });

  teardown(() => {
    sandbox.restore();
  });

  test('workspace path with spaces should be properly quoted', () => {
    const pathWithSpaces = '/Users/test/My Projects/workspace';
    sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ uri: { fsPath: pathWithSpaces } }]);

    rgSearch('test');

    const command = spawnStub.firstCall.args[0];
    assert(command.includes(`"${pathWithSpaces}"`), `Path not quoted in: ${command}`);
  });

  test('current file path with spaces should be properly quoted', () => {
    const filePathWithSpaces = '/Users/test/My Documents/current file.ts';

    // Mock getCurrentFilePath to return a path with spaces
    sandbox
      .stub(require('../../utils/searchCurrentFile'), 'getCurrentFilePath')
      .returns(filePathWithSpaces);

    // Set to search current file only
    cx.currentFileOnly = true;

    rgSearch('test');

    const command = spawnStub.firstCall.args[0];
    assert(command.includes(`"${filePathWithSpaces}"`), `File path not quoted in: ${command}`);
  });
});
