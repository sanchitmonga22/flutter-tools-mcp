# Contributing to Flutter Tools MCP

Thank you for your interest in contributing to Flutter Tools MCP! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and considerate of others when contributing and interacting with the community.

## How to Contribute

There are many ways to contribute to the project:

1. **Reporting Bugs**: If you find a bug, please create an issue using the bug report template.
2. **Suggesting Features**: Have an idea for a new feature? Open an issue using the feature request template.
3. **Documentation**: Help improve documentation by fixing typos, adding examples, or clarifying instructions.
4. **Code Contributions**: Contribute code by fixing bugs or implementing new features.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/flutter-tools-mcp.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm install`
5. Make your changes
6. Run tests (if available): `npm test`
7. Commit your changes with descriptive commit messages
8. Push to your branch: `git push origin feature/your-feature-name`
9. Submit a pull request

## Development Guidelines

### Code Style

- Follow the existing code style and formatting
- Use meaningful variable and function names
- Include comments for complex logic
- Write type definitions for all functions and variables

### Pull Request Process

1. Ensure your code builds and passes all tests
2. Update documentation as needed
3. Add tests for new features
4. Link the PR to any related issues
5. Wait for code review and address any feedback

### Commit Messages

Follow a clear and consistent commit message format:

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Start with a capital letter
- Limit the first line to 72 characters
- Reference issues and pull requests after the first line

Example:
```
Add screenshot functionality for iOS devices

- Implement screenshot capture using simctl
- Add error handling for device not found
- Add proper base64 encoding

Fixes #42
```

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [MIT License](LICENSE). 