# Changelog

All notable changes to this project will be documented in this file. See [Conventional Commits](https://www.conventionalcommits.org) for commit guidelines.

## [1.13.2](https://github.com/joshmu/periscope/compare/v1.13.1...v1.13.2) (2025-08-10)

### Bug Fixes

- **ripgrep:** handle paths with spaces by quoting paths ([7511939](https://github.com/joshmu/periscope/commit/75119390aa8f91b3e92433a08107137f8fad68c6))

## [1.13.1](https://github.com/joshmu/periscope/compare/v1.13.0...v1.13.1) (2025-08-08)

### Bug Fixes

- resolve sticky context bug in resume search ([5409bf6](https://github.com/joshmu/periscope/commit/5409bf6634550a4fc93d5dce71f1804e15dcf3d5))

# [1.13.0](https://github.com/joshmu/periscope/compare/v1.12.0...v1.13.0) (2025-08-06)

### Features

- **logging:** add output channel for extension logs ([10fd944](https://github.com/joshmu/periscope/commit/10fd944fc43771a48d9d030423c1b375822e862e))

# [1.12.0](https://github.com/joshmu/periscope/compare/v1.11.1...v1.12.0) (2025-07-12)

### Features

- add periscope.resumeSearch command to restore previous queries ([ea21ac5](https://github.com/joshmu/periscope/commit/ea21ac569c61040f2e143ce96a3d9c08844ca10a)), closes [#90](https://github.com/joshmu/periscope/issues/90)

## [1.11.1](https://github.com/joshmu/periscope/compare/v1.11.0...v1.11.1) (2025-06-15)

### Bug Fixes

- **current-file:** resolves current file search persisting across search invocations ([e1b8132](https://github.com/joshmu/periscope/commit/e1b8132ff6fc0555ee7a7fe976c5eca5b54fbf76))

# [1.11.0](https://github.com/joshmu/periscope/compare/v1.10.4...v1.11.0) (2025-06-11)

### Features

- **current-file:** support for extension command to automatically scope search to current file ([2cf7544](https://github.com/joshmu/periscope/commit/2cf75448db362eceb2804f6338ee262b28219756)), closes [#84](https://github.com/joshmu/periscope/issues/84)

## [1.10.4](https://github.com/joshmu/periscope/compare/v1.10.3...v1.10.4) (2025-05-26)

### Bug Fixes

- **kill-process:** ensure all process are killed on extension deactivation ([24872cb](https://github.com/joshmu/periscope/commit/24872cbae9404e9b39b93d76aeae2ddb92bbaf43))

## [1.10.3](https://github.com/joshmu/periscope/compare/v1.10.2...v1.10.3) (2025-05-16)

## [1.10.2](https://github.com/joshmu/periscope/compare/v1.10.1...v1.10.2) (2025-05-15)

## [1.10.1](https://github.com/joshmu/periscope/compare/v1.10.0...v1.10.1) (2025-05-15)

### Bug Fixes

- **rg:** fix resolving rg system path ([09a7d35](https://github.com/joshmu/periscope/commit/09a7d3531bcd1c1b83a34887344cf46ba9f4d9a1)), closes [#78](https://github.com/joshmu/periscope/issues/78)

# [1.10.0](https://github.com/joshmu/periscope/compare/v1.9.2...v1.10.0) (2025-03-22)

### Features

- **config:** enhance peek decoration options ([5a5b7be](https://github.com/joshmu/periscope/commit/5a5b7bec7e29452624c5a15d2d9de8b2c193b47f))
- **highlight:** highlight text match ([d245bbd](https://github.com/joshmu/periscope/commit/d245bbd6dd1547f086210956d1fe2c3367023921))
- **ripgrep:** update rgMatch handling and configuration defaults ([31d78fd](https://github.com/joshmu/periscope/commit/31d78fd6bbe395676af74699f8ec18c60401532f))

## [1.9.2](https://github.com/joshmu/periscope/compare/v1.9.1...v1.9.2) (2025-01-25)

### Bug Fixes

- **native-search:** update to trim whitespace to return valid results ([462b66f](https://github.com/joshmu/periscope/commit/462b66fb5f3669be4d8ca0c491ea1ebdc2402ec0))
- **rgQueryParams:** show correct query in title info after extracting ([219a820](https://github.com/joshmu/periscope/commit/219a82041a9b35a23648eef03349abdbfbac0881))

## [1.9.1](https://github.com/joshmu/periscope/compare/v1.9.0...v1.9.1) (2024-12-27)

### Bug Fixes

- correct async support for openInHorizontalSplit ([493f5dd](https://github.com/joshmu/periscope/commit/493f5dd13201c834c1d551719389a65d26868436))
- update ripgrep path handling and improve query extraction logic ([04d1ad3](https://github.com/joshmu/periscope/commit/04d1ad32080f4201128c49efb3acda4f8a9407d2))

# [1.9.0](https://github.com/joshmu/periscope/compare/v1.8.2...v1.9.0) (2024-12-21)

### Features

- support for platform specific extension on open-vsx.org ([143923b](https://github.com/joshmu/periscope/commit/143923bce29fa93ff18e259ad4f10885285e4c04))

## [1.8.1](https://github.com/joshmu/periscope/compare/v1.8.0...v1.8.1) (2024-10-10)

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
