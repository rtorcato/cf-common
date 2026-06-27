# cf-common

> Generated with [@rtorcato/js-tooling](https://www.npmjs.com/package/@rtorcato/js-tooling)

## Description

Your project description here.

## Installation

```bash
# Using pnpm (recommended)
pnpm install

# Using npm
npm install

# Using yarn
yarn install
```

## Development

Start development by running your preferred development server.

### Linting & Formatting

```bash
pnpm check:fix
```

### Type Checking

```bash
pnpm typecheck
```

## Testing

```bash
pnpm test          # Run tests
pnpm test:watch    # Run tests in watch mode
pnpm test:ui       # Run tests with UI
pnpm coverage      # Generate coverage report
```

## Building

```bash
pnpm build
```

## Scripts

- `pnpm install` - Install dependencies
- `pnpm typecheck` - Type check TypeScript
- `pnpm lint` - Lint code with Biome
- `pnpm format` - Format code with Biome
- `pnpm check:fix` - Lint and format with Biome
- `pnpm test` - Run tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm coverage` - Generate test coverage
- `pnpm build` - Build for production

## Project Structure

```
cf-common/
├── src/                 # Source code
├── reset.d.ts           # TypeScript reset types
├── tests/              # Test files
├── dist/               # Build output (library)
├── package.json
├── tsconfig.json        # TypeScript configuration
├── biome.jsonc          # Biome configuration


├── vitest.config.ts     # Vitest configuration


├── tsup.config.ts       # tsup configuration


├── commitlint.config.mjs # Commitlint configuration
├── .husky/             # Git hooks
└── README.md
```

## Tooling

This project uses:

- **TypeScript** - Type-safe JavaScript
- **Biome** - Fast formatter and linter
- **Vitest** - Fast testing framework
- **tsup** - TypeScript bundler
- **Husky** - Git hooks
- **lint-staged** - Run linters on staged files
- **Commitlint** - Conventional commit linting
- **Semantic Release** - Automated versioning and publishing

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


### Commit Convention

This project follows [Conventional Commits](https://conventionalcommits.org/):

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding or updating tests
- `chore:` maintenance tasks


## License

[Add your license here]
