# Periscope 🫧

![Visual Studio Marketplace Last Updated](https://img.shields.io/visual-studio-marketplace/last-updated/JoshMu.periscope)

Periscope is a VSCode extension that supercharges your ability to search workspace contents using [ripgrep](https://github.com/BurntSushi/ripgrep), providing an intuitive interface with real-time previews of search results.

_Inspired by nvim's [telescope](https://github.com/nvim-telescope/telescope.nvim)_

## Key Features

- **Fast Search**: Utilizes `ripgrep` for lightning-fast search capabilities.
- **Real-Time Preview**: See preview of files right in the search pane as you navigate through search results.
- **Customizable**: Extensive configuration options to tailor search behavior and UI to your needs.

![Demo](https://github.com/joshmu/periscope/blob/master/assets/demo.gif?raw=true)

## Usage Instructions

1. **Invoke Search**: Assign a keybinding such as `<super> + p` to invoke the `periscope.search` command. You can also access it via the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and search for **periscope**.
2. **Search and Preview**: Enter your query to see the search results dynamically. Navigate through results to preview files directly in the editor.
3. **Open or Cancel**: Press `Enter` to open the highlighted file or `Esc` to cancel and return to your work.

## Requirements

For optimal performance, ensure that the VSCode configuration _Editor: Enable Preview_ is enabled. This allows files to be previewed before opening them completely.

## Tips

- **Search with Regex**: Use regex in your search query to find specific patterns in your codebase.
- **Selected Text Search**: Highlight text in the editor and invoke `periscope.search` to have it automatically used as the initial query.
- **Raw Queries**: Enclosing your `search_term` in quotes will allow additional ripgrep parameters to be passed through. eg: `"foobar" -t js` will search for `foobar` in js files.
- **Utilise `rgQueryParams`**: Create shortcuts for common ripgrep search queries via regex matching against your current query. This provides a way to map your query to ripgrep parameters via capture groups in the regex for faster lookups.

## Configuration

- `rgOptions`: Additional options to pass to the 'rg' command, you can view all options in your terminal via 'rg --help'.
- `rgGlobExcludes`: Additional glob paths to exclude from the 'rg' search, eg: '**/dist/**'.
- `rgPath`: Option to explicitly set the `rg` binary to use. If not specified, an attempt to locate your rg binary occurs otherwise falling back to `@vscode/ripgrep`.
- `addSrcPaths`: Additional source paths to include in the rg search. You may want to add this as a workspace specific setting.
- `rgMenuActions`: Create menu items which can be selected prior to any query, these items will be added to the ripgrep command to generate the results. Eg: Add `{ "label": "JS/TS", "value": "--type-add 'jsts:*.{js|ts|tsx|jsx}' -t jsts" },` as a menu option to only show js & ts files in the results.
- `rgQueryParams`: Match ripgrep parameters from the input query directly. E.g: `{ "regex": \"^(.+) -t ?(\\w+)$\", "param": \"-t $1\" },` will translate the query `hello -t rust` to `rg 'hello' -t rust` to enable a filetype filter.
- `rgQueryParamsShowTitle`: When a ripgrep parameter match from the list in `rgQueryParams`, the quick pick will show the matched result as a preview in the title bar.
- `showWorkspaceFolderInFilePath`: Include workspace folder name in the folder depth display.
- `startFolderDisplayIndex`: The folder index to display in the results before '...'.
- `startFolderDisplayDepth`: The folder depth to display in the results before '...'.
- `endFolderDisplayDepth`: The folder depth to display in the results after '...'.
- `alwaysShowRgMenuActions`: If true, then open rg menu actions every time the search is invoked.
- `showPreviousResultsWhenNoMatches`: If true, when there are no matches for the current query, the previous results will still be shown.
- `gotoRgMenuActionsPrefix`: If the query starts with this prefix, then open rg menu actions.
- `enableGotoNativeSearch`: If true, then swap to native vscode search if the custom suffix is entered using the current query.
- `gotoNativeSearchSuffix`: If the query ends with this suffix, then swap to the native search with the query applied.
- `peekBorderColor`: Color of the peek border. If not set, uses the editor's find match highlight border color.
- `peekBorderWidth`: Width of the peek border (default: '2px')
- `peekBorderStyle`: Style of the peek border (solid, dashed, inset, double, groove, outset, ridge)
- `peekMatchColor`: Color used to highlight matching text. If not set, uses the editor's find match highlight color.
- `peekMatchBorderColor`: Border color for highlighted matching text. If not set, uses the editor's find match highlight border color.
- `peekMatchBorderWidth`: Border width for highlighted matching text (default: '1px')
- `peekMatchBorderStyle`: Border style for highlighted matching text (solid, dashed, inset, double, groove, outset, ridge)

## Advanced Configurations

Detailed examples for setting up advanced search parameters and UI customization are provided below to help you tailor Periscope to fit your workflow.

### periscope.rgQueryParams

Create shortcuts for common ripgrep search queries via regex matching against your current query. This provides a way to map your query to ripgrep parameters via capture groups in the regex.

Add the following to your `settings.json`:

```json
"periscope.rgQueryParams": [
  {
    // filter the results to a folder
    // Query: "redis -m module1"
    // After: "rg 'redis' -g '**/*module1*/**'"
    "regex": "^(.+) -m ([\\w-_]+)$",
    "param": "-g '**/*$1*/**' -g '!**/node_modules/**'"
  },
  {
    // filter the results to a folder and filetype
    // Query: "redis -m module1 yaml"
    // After: "rg 'redis' -g '**/*module1*/**/*.yaml'"
    "regex": "^(.+) -m ([\\w-_]+) ([\\w]+)$",
    "param": "-g '**/*$1*/**/*.$2'"
  },
  {
    // filter the results that match a glob
    // Query: "redis -g *module"
    // After: "rg 'redis' -g '*module'"
    "regex": "^(.+) -g (.+)$",
    "param": "-g '$1'"
  },
  {
    // filter the results to rg filetypes
    // Query: "redis -t yaml"
    // After: "rg 'redis' -t yaml"
    "regex": "^(.+) -t ?(\\w+)$",
    "param": "-t $1"
  },
  {
    // filter the results that match a file extension through a glob
    // Query: redis *.rs => rg 'redis' -g '*.rs'
    "regex": "^(.+) \\*\\.(\\w+)$",
    "param": "-g '*.$1'"
  }
],
```

### periscope.openInHorizontalSplit

Open the result preview in a horizontal split.

Add a keybinding (`keybindings.json`):

```json
{
  "key": "ctrl+v",
  "command": "periscope.openInHorizontalSplit",
  "when": "periscopeActive"
}
```

## Extension Settings

This extension contributes the following settings:

- `periscope.search`: Enable Periscope Search
- `periscope.openInHorizontalSplit`: Open the result preview in a horizontal split.

## Troubleshooting

For common issues and troubleshooting guidance, please visit the [Issues](https://github.com/joshmu/periscope/issues) section of our GitHub repository. If you encounter a problem not covered there, feel free to open a new issue.

## Contributing

Interested in contributing to Periscope? We welcome contributions of all forms. Please visit our [Contributions Page](https://github.com/joshmu/periscope/blob/master/CONTRIBUTING.md) for more information on how to get involved.

## Feedback and Support

For support with using Periscope or to provide feedback, please [open an issue](https://github.com/joshmu/periscope/issues/new) in our GitHub repository.
