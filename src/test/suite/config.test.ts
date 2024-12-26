import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { getConfig } from '../../utils/getConfig';

type WorkspaceConfiguration = vscode.WorkspaceConfiguration;

suite('Configuration Tests', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  test('should validate default settings', () => {
    // Mock workspace configuration
    const mockConfig: Partial<WorkspaceConfiguration> = {
      get<T>(section: string, defaultValue?: T): T | undefined {
        return defaultValue;
      },
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockConfig as WorkspaceConfiguration);

    // Get the config
    const config = getConfig();

    // Verify default values
    assert.deepStrictEqual(
      config.rgOptions,
      ['--smart-case', '--sortr path'],
      'Default rgOptions should be set correctly',
    );
    assert.deepStrictEqual(config.addSrcPaths, [], 'Default addSrcPaths should be empty array');
    assert.deepStrictEqual(config.rgGlobExcludes, [], 'Default rgGlobExcludes should be empty array');
    assert.deepStrictEqual(config.rgMenuActions, [], 'Default rgMenuActions should be empty array');
    assert.deepStrictEqual(config.rgQueryParams, [], 'Default rgQueryParams should be empty array');
    assert.strictEqual(config.rgQueryParamsShowTitle, true, 'Default rgQueryParamsShowTitle should be true');
    assert.strictEqual(
      config.showWorkspaceFolderInFilePath,
      true,
      'Default showWorkspaceFolderInFilePath should be true',
    );
    assert.strictEqual(config.startFolderDisplayIndex, 0, 'Default startFolderDisplayIndex should be 0');
    assert.strictEqual(config.startFolderDisplayDepth, 1, 'Default startFolderDisplayDepth should be 1');
    assert.strictEqual(config.endFolderDisplayDepth, 4, 'Default endFolderDisplayDepth should be 4');
    assert.strictEqual(config.alwaysShowRgMenuActions, true, 'Default alwaysShowRgMenuActions should be true');
    assert.strictEqual(
      config.showPreviousResultsWhenNoMatches,
      false,
      'Default showPreviousResultsWhenNoMatches should be false',
    );
    assert.strictEqual(config.gotoRgMenuActionsPrefix, '<<', 'Default gotoRgMenuActionsPrefix should be <<');
    assert.strictEqual(config.enableGotoNativeSearch, true, 'Default enableGotoNativeSearch should be true');
    assert.strictEqual(config.gotoNativeSearchSuffix, '>>', 'Default gotoNativeSearchSuffix should be >>');
    assert.strictEqual(
      config.peekBorderColor,
      'rgb(150,200,200)',
      'Default peekBorderColor should be rgb(150,200,200)',
    );
    assert.strictEqual(config.peekBorderWidth, '2px', 'Default peekBorderWidth should be 2px');
    assert.strictEqual(config.peekBorderStyle, 'solid', 'Default peekBorderStyle should be solid');
  });
});
