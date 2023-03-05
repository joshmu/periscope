# ![icon](https://github.com/joshmu/periscope/blob/master/assets/icon.png) Periscope

## Features

Periscope is a Vscode extension for high powered workspace contents search utilising [ripgrep](https://github.com/BurntSushi/ripgrep) with on the fly peek across all suggestions.

![Demo](https://github.com/joshmu/periscope/blob/master/assets/demo.gif?raw=true)

_Inspired by nvim's [telescope](https://github.com/nvim-telescope/telescope.nvim)_

## Instructions

1. Ideally assign a keybinding such as `super + p` or use the command prompt and search for _periscope_.`
2. Input your query and move through the suggested results, the editor will reflect the current highlighted suggested item.
3. Hit enter to open the file or cancel to return to your original active editor

## Requirements

[ripgrep]( https://github.com/BurntSushi/ripgrep#installation ) installed on your local system.

## Extension Settings

This extension contributes the following settings:

* `periscope.search`: Enable Periscope Search

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of Periscope

## TODO

* [ ] FZF - improve the fuzzy search algorithm
* [ ] config: define custom base path (to be able to search outside of the current workspace)
* [ ] config: option to add additional excludes
* [ ] config: option to update the rg command
* [ ] search engine swap - allow for user to define their own search engine
