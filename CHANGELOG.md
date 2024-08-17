# Changelog

All notable changes to this project will be documented in this file. See [Conventional Commits](https://www.conventionalcommits.org) for commit guidelines.

# [1.8.0](https://github.com/joshmu/periscope/compare/v1.7.4...v1.8.0) (2024-08-17)

### Features

- support for passing rg parameters directly when search term is enclosed by quotation marks ([ea125af](https://github.com/joshmu/periscope/commit/ea125af3d33021415a90f4ea48125555bab8e15b))

## [1.7.4](https://github.com/joshmu/periscope/compare/v1.7.3...v1.7.4) (2024-08-04)

## [1.7.3](https://github.com/joshmu/periscope/compare/v1.7.2...v1.7.3) (2024-08-03)

## [1.7.2](https://github.com/joshmu/periscope/compare/v1.7.1...v1.7.2) (2024-08-03)

## [1.7.1](https://github.com/joshmu/periscope/compare/v1.7.0...v1.7.1) (2024-08-02)

### Bug Fixes

- update vsce ([39dae80](https://github.com/joshmu/periscope/commit/39dae8078e714a5f185a18ebcc79a75ba981728f))

# [1.7.0](https://github.com/joshmu/periscope/compare/v1.6.10...v1.7.0) (2024-08-02)

### Features

- support paths which contain whitespace ([c001fe2](https://github.com/joshmu/periscope/commit/c001fe2297e1a8a3d4c5ac48b4ae0ce9898e1b57))

## [1.6.10](https://github.com/joshmu/periscope/compare/v1.6.9...v1.6.10) (2024-04-28)

## [1.6.9](https://github.com/joshmu/periscope/compare/v1.6.8...v1.6.9) (2024-04-28)

## [1.6.8](https://github.com/joshmu/periscope/compare/v1.6.7...v1.6.8) (2024-04-28)

## [1.6.7](https://github.com/joshmu/periscope/compare/v1.6.6...v1.6.7) (2024-04-28)

## [1.6.6](https://github.com/joshmu/periscope/compare/v1.6.5...v1.6.6) (2024-04-28)

## [1.6.5](https://github.com/joshmu/periscope/compare/v1.6.4...v1.6.5) (2024-04-28)

## [1.6.4](https://github.com/joshmu/periscope/compare/v1.6.3...v1.6.4) (2024-04-28)

## [1.6.3](https://github.com/joshmu/periscope/compare/v1.6.2...v1.6.3) (2024-04-28)

### Bug Fixes

- update tsconfig to resolve ci ([fa7bafe](https://github.com/joshmu/periscope/commit/fa7bafed1a032748b0ef82ebb9cb0134d59f4e27))

## [1.6.2](https://github.com/joshmu/periscope/compare/v1.6.1...v1.6.2) (2024-04-28)

## 1.6.1 (2024-04-28)

##### New Features

- with shared context ([d6cf1693](https://github.com/joshmu/periscope/commit/d6cf169376cfc59ea68bb2b8d666e22ffe13e81c))
- when no results show origin document ([dfd176d7](https://github.com/joshmu/periscope/commit/dfd176d791fef6152a222ed1077d58d36d6faf28))
- improve logs ([cbfc7916](https://github.com/joshmu/periscope/commit/cbfc7916aef333f4e54dd86aef2138fc68d7c79f))
- include @semantic-release/git to update package.json versioning ([c994ade2](https://github.com/joshmu/periscope/commit/c994ade2d0fffb970cf1e5130f8bdee765e5c311))
- update vscode ripgrep package ([a6c15c6f](https://github.com/joshmu/periscope/commit/a6c15c6f9e1fa9a24b3d60328f3c92ffbd3b078b))
- pipeline publish integration ([416b4ec0](https://github.com/joshmu/periscope/commit/416b4ec084c2fb8f60f37a7de61fcd179a9d9b83))
- option to apply custom rg commands ([7e38da92](https://github.com/joshmu/periscope/commit/7e38da929499a7065c5a8e77b346f568c88283f6))
- rg actions shortcut ([dc7c622d](https://github.com/joshmu/periscope/commit/dc7c622d07a9881c8fb2f674bd329a6f9fc42e77))
- improved rg menu actions ([13002dbc](https://github.com/joshmu/periscope/commit/13002dbcd10a50c994ca1944168574fc69f85b84))
- optional rg menu actions ([37d1829c](https://github.com/joshmu/periscope/commit/37d1829c911ed97efe7ad89fc53acadabd285d3b))
- update default color so light theme is valid ([a44d82b6](https://github.com/joshmu/periscope/commit/a44d82b6288e426781cca968b2b9d63902cb07db))
- use white color for peek highlight default ([bec3d889](https://github.com/joshmu/periscope/commit/bec3d889f50a4db8d77015374bf8f0313f424678))
- peek highlight ([47d38dc0](https://github.com/joshmu/periscope/commit/47d38dc077079360d752760c8952354985f17e14))
- jump to native search, additional display options ([fe56a836](https://github.com/joshmu/periscope/commit/fe56a836348bad8a4e1ad17c7767d725b7daa6ee))

##### Bug Fixes

- rg menu actions resolved via app state machine, additional refactor also ([c34ae789](https://github.com/joshmu/periscope/commit/c34ae7898442be053faa7c252b68d6a5daa740b6))
- cursor col position ([a75608e3](https://github.com/joshmu/periscope/commit/a75608e3586bc4fa9f12190aea624798db8bdd00))
- improve handling of child processes ([49580f8e](https://github.com/joshmu/periscope/commit/49580f8ea6ff72cc892ea505c20c227d67b8a6bf))
- rg line json parse error handling ([1c4d9589](https://github.com/joshmu/periscope/commit/1c4d9589492d952275e57f8ebc3003142507d823))
- pipeline publish condition to invoke once matrix complete, semantic-release will automate tag creation ([7db87476](https://github.com/joshmu/periscope/commit/7db874761d768774c5d1deb2f03786bab304bf01))
- pipline vscode publish platform compatibility ([f9a52cee](https://github.com/joshmu/periscope/commit/f9a52cee6f77b84571b78d4974833d09d4c2f369))
- extension OS compatibility ([ec117db7](https://github.com/joshmu/periscope/commit/ec117db7f65ab2d2e2b1108bf00050912af52af2))
- allow new rg install to define correct platform binary ([c0ac93ff](https://github.com/joshmu/periscope/commit/c0ac93ff05b6480eef89c89ae4ee0696b6cd79fb))
- quick pick item show all ([e113b22c](https://github.com/joshmu/periscope/commit/e113b22cc09ae3234de85b5c09a8b2b0130ceced))
