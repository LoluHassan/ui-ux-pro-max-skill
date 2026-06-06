# uipro-uimax-cli

CLI to install UI/UX Pro Max skill for AI coding assistants.

## Installation

```bash
npm install -g uipro-uimax-cli
```

## Usage

```bash
# Install for specific AI assistant
uipro-uimax init --ai claude      # Claude Code
uipro-uimax init --ai cursor      # Cursor
uipro-uimax init --ai windsurf    # Windsurf
uipro-uimax init --ai antigravity # Antigravity
uipro-uimax init --ai copilot     # GitHub Copilot
uipro-uimax init --ai kiro        # Kiro
uipro-uimax init --ai codex       # Codex (Skills)
uipro-uimax init --ai roocode     # Roo Code
uipro-uimax init --ai qoder       # Qoder
uipro-uimax init --ai gemini      # Gemini CLI
uipro-uimax init --ai trae        # Trae
uipro-uimax init --ai opencode    # OpenCode
uipro-uimax init --ai continue    # Continue (Skills)
uipro-uimax init --ai all         # All assistants

# Options
uipro-uimax init --offline        # Skip GitHub download, use bundled assets only
uipro-uimax init --force          # Overwrite existing files

# Other commands
uipro-uimax versions              # List available versions
uipro-uimax update                # Update to latest version
```

## How It Works

By default, `uipro-uimax init` tries to download the latest release from GitHub to ensure you get the most up-to-date version. If the download fails (network error, rate limit), it automatically falls back to the bundled assets included in the CLI package.

Use `--offline` to skip the GitHub download and use bundled assets directly.

## Development

```bash
# Install dependencies
bun install

# Run locally
bun run src/index.ts --help

# Build
bun run build

# Link for local testing
bun link
```

## License

CC-BY-NC-4.0
