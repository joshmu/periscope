# Contributing to Periscope

Thank you for your interest in contributing to Periscope! We welcome contributions from the community to help improve and enhance the extension.

## Getting Started

### Prerequisites

- [Git](https://git-scm.com/)
- [NodeJS](https://nodejs.org/en/)
- [Npm](https://www.npmjs.com/get-npm)

### General Process

To get started with contributing, please follow these steps:

1. Fork the repository and clone it to your local machine.
2. Install the required dependencies by running `npm install`.
3. Make your changes or additions to the codebase.
4. Test your changes to ensure they work as expected.
5. Commit your changes and push them to your forked repository.
6. Open a pull request to the main repository.

### Running Tests

- Run all tests: `npm test`
- Run tests matching a pattern: `npm run test:single --grep="pattern"`
- Run a specific test file: `npm run test:file --file=extension` (omit .test.ts)
- Run tests without linting: `npm run test:no-lint`
- Tests run against the fixture workspace in `test/fixtures/workspace/`
- Test helpers are available in `test/utils/periscopeTestHelper.ts`
- If a test needs specific files/content, add them to the fixtures workspace

Test files go in `test/suite/` with naming convention `*.test.ts`

For detailed testing documentation, see [docs/TESTING.md](docs/TESTING.md)

### Running the extension

Open the extension project in VS Code (e.g. by running `code .` in the project folder).

To run the extension in development mode:

1. Run the `View: Show Run and Debug` command (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>).
1. Select the green play icon, or press <kbd>F5</kbd>.

You can read through the [Running and debugging your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension#run-the-extension) section of the official documentation.

#### Make changes

- You can relaunch the extension from the debug toolbar after changing code in `src/extension.ts`.
- You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

#### Explore the API

- You can open the full set of our API when you open the file `node_modules/@types/vscode/index.d.ts`.

#### Run tests

- Open the debug viewlet (`Ctrl+Shift+D` or `Cmd+Shift+D` on Mac) and from the launch configuration dropdown:
  - `Extension Tests` - runs all tests
  - `Extension Tests (Single)` - prompts for pattern to filter tests
  - `Extension Tests (File)` - prompts for specific test file
- Press `F5` to run the tests in a new window with your extension loaded.
- See the output of the test result in the debug console.
- Make changes to `src/test/suite/extension.test.ts` or create new test files inside the `test/suite` folder.
  - The provided test runner will only consider files matching the name pattern `**.test.ts`.
  - You can create folders inside the `test` folder to structure your tests any way you want.

### Troubleshooting

Logs can be found by running `Developer: Show Logs ...` command (using `cmd+shift+p`) and selecting `Extension Host`.

You can always use debugger when you are running the extension in development mode.

## Code Guidelines

Please adhere to the following guidelines when contributing to the project:

- Follow the coding style and conventions used in the existing codebase.
- Write clear and concise code with appropriate comments where necessary.
- Ensure your code is well-tested and does not introduce any regressions.
- Document any new features or changes in the appropriate sections.

## Issue Reporting

If you encounter any bugs, issues, or have feature requests, please open an issue on the repository. Provide as much detail as possible, including steps to reproduce the issue and any relevant error messages.

## Thank you

We appreciate your contributions and look forward to your involvement in improving Periscope!

Happy coding!
