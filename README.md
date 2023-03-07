# Periscope 🫧

## Features

Periscope is a Vscode extension for high powered workspace contents search utilising [ripgrep](https://github.com/BurntSushi/ripgrep) with on the fly peek across result suggestions.

![Demo](https://github.com/joshmu/periscope/blob/master/assets/demo.gif?raw=true)

_Inspired by nvim's [telescope](https://github.com/nvim-telescope/telescope.nvim)_

## Instructions

1. Ideally assign a keybinding such as `<super> + p` to invoke the `periscope.search` command.  Otherwise you can use the command prompt and search for __periscope__.
2. Input your query and move through the suggested results, the editor will reflect the current highlighted suggested item.
3. Hit enter to open the file or cancel to return to your original active editor

## Requirements

[Install ripgrep](https://github.com/BurntSushi/ripgrep#installation)

## Extension Settings

This extension contributes the following settings:

* `periscope.search`: Enable Periscope Search

### Configuration Options

* `rgOptions`: Additional options to pass to the 'rg' command, you can view all options in your terminal via 'rg --help'.
* `rgGlobExcludes`: Additional glob paths to exclude from the 'rg' search, eg: '**/dist/**'.
* `addSrcPaths`: Additional source paths to include in the rg search. You may want to add this as a workspace specific setting.
* `folderDisplayDepth`: The folder depth to display in the results.


## Todo

* [ ] Support fuzzy search (fzf)
