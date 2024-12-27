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

The project uses Mocha for testing. To run the test suite:

1. Run all tests: `npm test`
2. Run specific test file: `npm test -- path/to/test`

When writing tests:

- Place test files in `src/test/suite/`
- Use the naming convention `*.test.ts`
- Group related tests using `suite()` and `test()`
- Keep tests focused and simple
- Mock external dependencies
- Use descriptive test names that explain the expected behavior

Example test structure:

```typescript
suite('Feature Name', () => {
  test('should handle specific case', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

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

- Open the debug viewlet (`Ctrl+Shift+D` or `Cmd+Shift+D` on Mac) and from the launch configuration dropdown pick `Extension Tests`.
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
