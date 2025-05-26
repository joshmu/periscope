import * as assert from 'assert';
import * as sinon from 'sinon';
import { ChildProcess } from 'child_process'; // For typing mock processes
import { context as cx } from '../../lib/context';
import { checkAndExtractRgFlagsFromQuery, checkKillProcess } from '../../lib/ripgrep'; // Import checkKillProcess

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

  // Helper to create a mock ChildProcess
  const createMockProcess = (killedState: boolean) => {
    const mockProcess = {
      killed: killedState,
      kill: sandbox.spy(),
      stdout: {
        destroy: sandbox.spy(),
      },
      stderr: {
        destroy: sandbox.spy(),
      },
    } as unknown as ChildProcess; // Type assertion
    return mockProcess;
  };

  setup(() => {
    sandbox = sinon.createSandbox();
    cx.spawnRegistry = []; // Reset registry before each test
  });

  teardown(() => {
    sandbox.restore();
    cx.spawnRegistry = []; // Clean up just in case
  });

  test('should do nothing if spawnRegistry is empty', () => {
    checkKillProcess();
    assert.deepStrictEqual(cx.spawnRegistry, []);
    // No specific spy checks needed as no processes means no calls.
  });

  test('should kill a single active process and clear registry', () => {
    const mockProc = createMockProcess(false);
    cx.spawnRegistry.push(mockProc);

    checkKillProcess();

    assert(mockProc.kill.calledOnce, 'kill should be called once');
    assert(mockProc.stdout.destroy.calledOnce, 'stdout.destroy should be called once');
    assert(mockProc.stderr.destroy.calledOnce, 'stderr.destroy should be called once');
    assert.deepStrictEqual(cx.spawnRegistry, [], 'spawnRegistry should be empty');
  });

  test('should kill multiple active processes and clear registry', () => {
    const mockProc1 = createMockProcess(false);
    const mockProc2 = createMockProcess(false);
    cx.spawnRegistry.push(mockProc1, mockProc2);

    checkKillProcess();

    assert(mockProc1.kill.calledOnce, 'mockProc1.kill should be called once');
    assert(mockProc1.stdout.destroy.calledOnce, 'mockProc1.stdout.destroy should be called once');
    assert(mockProc1.stderr.destroy.calledOnce, 'mockProc1.stderr.destroy should be called once');

    assert(mockProc2.kill.calledOnce, 'mockProc2.kill should be called once');
    assert(mockProc2.stdout.destroy.calledOnce, 'mockProc2.stdout.destroy should be called once');
    assert(mockProc2.stderr.destroy.calledOnce, 'mockProc2.stderr.destroy should be called once');

    assert.deepStrictEqual(cx.spawnRegistry, [], 'spawnRegistry should be empty');
  });

  test('should not attempt to kill an already killed process and clear registry', () => {
    const mockProc = createMockProcess(true);
    cx.spawnRegistry.push(mockProc);

    checkKillProcess();

    assert(mockProc.kill.notCalled, 'kill should not be called');
    assert(mockProc.stdout.destroy.notCalled, 'stdout.destroy should not be called');
    assert(mockProc.stderr.destroy.notCalled, 'stderr.destroy should not be called');
    assert.deepStrictEqual(cx.spawnRegistry, [], 'spawnRegistry should be empty');
  });

  test('should handle a mix of active and killed processes and clear registry', () => {
    const activeProc = createMockProcess(false);
    const killedProc = createMockProcess(true);
    cx.spawnRegistry.push(activeProc, killedProc);

    checkKillProcess();

    // Assertions for the active process
    assert(activeProc.kill.calledOnce, 'activeProc.kill should be called once');
    assert(activeProc.stdout.destroy.calledOnce, 'activeProc.stdout.destroy should be called once');
    assert(activeProc.stderr.destroy.calledOnce, 'activeProc.stderr.destroy should be called once');

    // Assertions for the already killed process
    assert(killedProc.kill.notCalled, 'killedProc.kill should not be called');
    assert(killedProc.stdout.destroy.notCalled, 'killedProc.stdout.destroy should not be called');
    assert(killedProc.stderr.destroy.notCalled, 'killedProc.stderr.destroy should not be called');

    assert.deepStrictEqual(cx.spawnRegistry, [], 'spawnRegistry should be empty');
  });
});
