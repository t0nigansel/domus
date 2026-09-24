# Contributing to Domus

Thank you for your interest in contributing to Domus! This guide will help you understand our development workflow and CI/CD pipeline.

## Development Workflow

### 1. Fork and Clone

```bash
git clone https://github.com/t0nigansel/domus.git
cd domus
npm install
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes

Follow our coding standards:
- Use ESLint configuration (runs automatically)
- Write tests for new features
- Keep commits small and focused

### 4. Test Locally

Before pushing, run all checks locally:

```bash
# Run linter
npm run lint

# Run unit tests
npm test

# Run E2E tests (requires Playwright)
npm run test:e2e

# Optional: Run full test agents
npm run test:agents
```

### 5. Commit and Push

```bash
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

### 6. Create Pull Request

- Open a PR against the `main` branch
- Fill in the PR template
- Wait for CI checks to pass
- Request review from maintainers

## CI/CD Pipeline

### Automated Checks

Every push and pull request triggers:

#### 1. **Lint Job**
- Runs ESLint on all code
- Must pass with 0 errors
- Helps maintain code quality

#### 2. **Unit Tests Job**
- Runs Vitest with coverage
- Uploads coverage reports
- Comments coverage on PRs
- Must have >80% coverage for critical code

#### 3. **E2E Tests Job**
- Runs Playwright browser tests
- Tests user flows and interactions
- Uploads test reports and videos
- Must pass all critical user journeys

#### 4. **Build Job**
- Verifies production build
- Uploads build artifacts
- Ensures no build-time errors

### CI Workflow Triggers

The CI pipeline runs on:
- Every push to `main` or `develop` branches
- Every pull request to `main` or `develop` branches
- Manual workflow dispatch (Actions tab)

### Special Commit Messages

Include these in your commit message for special behavior:

- `[run-agents]` - Triggers full test agent analysis on the PR
- `[skip ci]` - Skips CI (use sparingly, only for docs)

### Nightly Builds

A comprehensive test agent analysis runs every night at 2 AM UTC:
- Runs all test agents (linter, unit tests, E2E tests)
- Generates detailed reports
- Creates GitHub issues on failure
- Auto-closes issues when fixed

## PR Review Process

1. **Automated Checks** - All CI jobs must pass
2. **Code Review** - At least one maintainer approval required
3. **Test Coverage** - New code should be tested
4. **Documentation** - Update docs if needed

## Troubleshooting CI

### Failed Lint Job

```bash
# Fix linting errors locally
npm run lint

# Some errors can be auto-fixed
npm run lint -- --fix
```

### Failed Unit Tests

```bash
# Run tests locally
npm test

# Run with UI for debugging
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Failed E2E Tests

```bash
# Install Playwright if needed
npx playwright install --with-deps

# Run E2E tests
npm run test:e2e

# Debug with UI mode
npx playwright test --ui
```

### Build Failures

```bash
# Test build locally
npm run build

# Check for TypeScript/ESLint errors
npm run lint
```

## Getting Help

- Check existing [issues](https://github.com/t0nigansel/domus/issues)
- Read the [README](../README.md)
- Ask in pull request comments
- Review [test agent documentation](../agents/README.md)

## Code Style

- Follow ESLint rules (enforced by CI)
- Use meaningful variable names
- Write clear commit messages
- Add comments for complex logic
- Keep functions small and focused

## Testing Guidelines

### Unit Tests
- Test business logic and utilities
- Mock external dependencies
- Aim for >80% coverage

### E2E Tests
- Test critical user flows
- Avoid testing implementation details
- Keep tests independent

### Test Agents
- Run locally before pushing
- Review generated reports
- Address high-priority issues

## Release Process

1. All tests pass on `main`
2. Version bump in `package.json`
3. Tag release: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions creates release

## Questions?

Open an issue or reach out to maintainers!
