# Periscope 🫧

## Features

Periscope is a Vscode extension for high powered workspace contents search utilising [ripgrep](https://github.com/BurntSushi/ripgrep) with on the fly peek across result suggestions.

![Demo](https://github.com/joshmu/periscope/blob/master/assets/demo.gif?raw=true)

_Inspired by nvim's [telescope](https://github.com/nvim-telescope/telescope.nvim)_

## Instructions

1. Ideally assign a keybinding such as `<super> + p` to invoke the `periscope.search` command. Otherwise you can use the command prompt and search for **periscope**.
2. Input your query and move through the suggested results, the editor will reflect the current highlighted suggested item.
3. Hit enter to open the file or cancel to return to your original active editor

## Extension Settings

This extension contributes the following settings:

- `periscope.search`: Enable Periscope Search

### Configuration Options

- `rgOptions`: Additional options to pass to the 'rg' command, you can view all options in your terminal via 'rg --help'.
- `rgGlobExcludes`: Additional glob paths to exclude from the 'rg' search, eg: '**/dist/**'.
- `rgPath`: Optional path to the `rg` binary. If not specified, the ripgrep bundled with vscode will be used.
- `addSrcPaths`: Additional source paths to include in the rg search. You may want to add this as a workspace specific setting.
- `rgMenuActions`: Create menu items which can be selected prior to any query, these items will be added to the ripgrep command to generate the results. Eg: Add `{ "label": "JS/TS", "value": "--type-add 'jsts:*.{js|ts|tsx|jsx}' -t jsts" },` as a menu option to only show js & ts files in the results.
- `rgQueryParams`: Match ripgrep parameters from the input query directly. E.g: `{ "param": \"-t $1\", "regex": \"^(.+) -t ?(\\w+)$\" },` will translate the query `hello -t rust` to `rg 'hello' -t rust`.
- `startFolderDisplayDepth`: The folder depth to display in the results before '...'.
- `endFolderDisplayDepth`: The folder depth to display in the results after '...'.
- `alwaysShowRgMenuActions`: If true, then open rg menu actions every time the search is invoked.
- `gotoRgMenuActionsPrefix`: If the query starts with this prefix, then open rg menu actions.
- `enableGotoNativeSearch`: If true, then swap to native vscode search if the custom suffix is entered using the current query.
- `gotoNativeSearchSuffix`: If the query ends with this suffix, then swap to the native search with the query applied.
- `peekBorderColor`: Change the peek color ('white', '#FFF' '#FFFFFFF', 'rgb(255,255,255)','rgba(255, 255, 255. 0.5) )
- `peekBorderWidth`: Change the peek border width (px)
- `peekBorderStyle`: Change the peek border style (solid, dashed, inset, double, groove, outset, ridge)

### Other commands

#### periscope.openInHorizontalSplit

Open the selected entry in a horizontal split.

Add a keybinding (`keybindings.json`):

```json
{
  "key": "ctrl+v",
  "command": "periscope.openInHorizontalSplit",
  "when": "periscopeActive"
}
```

### Configuration Examples

#### periscope.rgQueryParams

```json
"periscope.rgQueryParams": [
  {
    // filter the results to a folder
    // Query: redis -m module1 => rg 'redis' -g '**/*module1*/**'
    "param": "-g '**/*$1*/**' -g '!**/node_modules/**'",
    "regex": "^(.+) -m ([\\w-_]+)$"
  },
  {
    // filter the results to a folder and filetype
    // Query: redis -m module1 yaml => rg 'redis' -g '**/*module1*/**/*.yaml'
    "param": "-g '**/*$1*/**/*.$2'",
    "regex": "^(.+) -m ([\\w-_]+) ([\\w]+)$"
  },
  {
    // filter the results that match a glob
    // Query: redis -g *module => rg 'redis' -g '*module'
    "param": "-g '$1'",
    "regex": "^(.+) -g (.+)$"
  },
  {
    // filter the results to rg filetypes
    // Query: redis -t yaml => rg 'redis' -t yaml
    "param": "-t $1",
    "regex": "^(.+) -t ?(\\w+)$"
  },
  {
    // filter the results that match a file extension through a glob
    // Query: redis *.rs => rg 'redis' -g '*.rs'
    "param": "-g '*.$1'",
    "regex": "^(.+) \\*\\.(\\w+)$"
  }
],
```
