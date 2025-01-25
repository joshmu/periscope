import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AllQPItemVariants } from '../../types';
import { context as cx } from '../../lib/context';
import { formatNativeVscodeQuery, openNativeVscodeSearch } from '../../lib/editorActions';

suite('Editor Actions', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  suite('formatNativeVscodeQuery', () => {
    test('should remove suffix and trim whitespace', () => {
      const result = formatNativeVscodeQuery('search query >>', '>>');
      assert.strictEqual(result, 'search query');
    });

    test('should handle query without suffix', () => {
      const result = formatNativeVscodeQuery('search query', '>>');
      assert.strictEqual(result, 'search query');
    });

    test('should handle query with multiple suffixes', () => {
      const result = formatNativeVscodeQuery('search query >> >>', '>>');
      assert.strictEqual(result, 'search query');
    });

    test('should handle empty query', () => {
      const result = formatNativeVscodeQuery('', '>>');
      assert.strictEqual(result, '');
    });
  });

  suite('openNativeVscodeSearch', () => {
    test('should execute native search command with correct parameters', () => {
      // Mock context config
      sandbox.stub(cx, 'config').value({
        gotoNativeSearchSuffix: '>>',
      });

      // Mock vscode commands
      const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

      // Create mock QuickPick
      const mockQuickPick = {
        hide: sandbox.stub(),
      } as unknown as vscode.QuickPick<AllQPItemVariants>;

      // Execute function
      openNativeVscodeSearch('test query >>', mockQuickPick);

      // Verify command execution
      assert.strictEqual(executeCommandStub.calledOnce, true, 'Should execute command once');
      assert.strictEqual(
        executeCommandStub.firstCall.args[0],
        'workbench.action.findInFiles',
        'Should call correct command',
      );
      assert.deepStrictEqual(
        executeCommandStub.firstCall.args[1],
        {
          query: 'test query',
          isRegex: true,
          isCaseSensitive: false,
          matchWholeWord: false,
          triggerSearch: true,
        },
        'Should pass correct parameters',
      );
    });

    test('should handle empty query', () => {
      // Mock context config
      sandbox.stub(cx, 'config').value({
        gotoNativeSearchSuffix: '>>',
      });

      // Mock vscode commands
      const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand');

      // Create mock QuickPick
      const mockQuickPick = {
        hide: sandbox.stub(),
      } as unknown as vscode.QuickPick<AllQPItemVariants>;

      // Execute function
      openNativeVscodeSearch('', mockQuickPick);

      // Verify command execution
      assert.strictEqual(executeCommandStub.calledOnce, true, 'Should execute command once');
      assert.deepStrictEqual(
        executeCommandStub.firstCall.args[1],
        {
          query: '',
          isRegex: true,
          isCaseSensitive: false,
          matchWholeWord: false,
          triggerSearch: true,
        },
        'Should pass empty query',
      );
    });
  });
});
