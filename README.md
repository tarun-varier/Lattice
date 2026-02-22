# Lattice

A VS Code extension that serves as a structured AI frontend builder. Sketch layouts visually, describe your intent, and generate production-ready component code.

## Features

- **Visual Layout Builder** - Drag and drop boxes to create UI structures with a flexbox-based canvas
- **AI-Powered Generation** - Generate framework-specific component code using OpenAI or Anthropic models
- **Multi-Page Projects** - Create and manage multiple pages within a single project
- **Shared Components** - Create reusable components and track instances across your project
- **Code Management** - Version history, syntax highlighting, and direct export to your workspace
- **Streaming Generation** - Real-time code generation with live preview
- **Project Persistence** - Save and restore project state across VS Code sessions

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```

## Development

### Running in Development Mode

Watch both the extension and webview for changes:
```bash
npm run watch
```

Or run them separately:
```bash
npm run dev:extension  # Watch extension
npm run dev:webview    # Watch webview
```

### Build for Production

```bash
npm run build
```

This builds both the extension and webview bundles.

## Usage

1. Open the Command Palette (Ctrl/Cmd+Shift+P)
2. Run `Lattice: Open`
3. Configure your project settings:
   - Select your framework (React, Next.js, Vue, Nuxt, Svelte, SvelteKit)
   - Choose language (TypeScript/JavaScript)
   - Set UI library (Tailwind, shadcn/ui, MUI, CSS Modules, Styled Components)
   - Configure AI provider (OpenAI or Anthropic) and API key
4. Start building:
   - Drag boxes onto the canvas to create your layout
   - Add specifications to describe component intent and behavior
   - Generate code with AI
   - Export to your project

## Architecture

### Extension Layer (TypeScript)
- Handles VS Code integration
- Manages file I/O operations
- Proxies AI API calls
- Provides webview hosting

### Webview Layer (React + TypeScript + Tailwind)
- Visual canvas interface
- Drag-and-drop layout editor
- Code output panel with syntax highlighting
- State management with Zustand

### AI Integration
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-3.5 Turbo
- **Anthropic**: Claude Sonnet 4, Claude 3.5 Sonnet, Claude 3 Haiku
- Streaming response support
- Context-aware prompt engineering

## Project Structure

```
lattice/
├── src/
│   ├── extension/       # VS Code extension code
│   ├── webview/         # React UI application
│   └── shared/          # Shared types and utilities
├── dist/                # Built extension and webview bundles
├── .lattice/            # Project data (auto-generated)
└── package.json
```

## Configuration

Projects are automatically saved to `.lattice/project.json` in your workspace, containing:
- Layout and box configurations
- Specification data
- Page structures
- Shared component definitions
- Project settings

## Requirements

- VS Code 1.85.0 or higher
- Node.js (for development)
- API key for OpenAI or Anthropic

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
