# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Build (compiles TypeScript to build/)
npm run build

# Development mode (runs TypeScript directly with tsx)
npm run dev

# Start the server (requires build first)
npm start
# or
node build/index.js

# Run via npx (for users)
npx figma-mcp-full-server
```

The Figma token must be provided via the `FIGMA_TOKEN` environment variable.

## Testing

```bash
# SVG export test (standalone)
FIGMA_TOKEN=figd_xxx npx tsx test-svg-export.ts "<figma-url>" [options]

# Options:
#   --full, -f       Output full SVG (no truncation)
#   --output=FILE    Save SVG to file
#   --help           Show help
```

## Architecture Overview

This is a Model Context Protocol (MCP) server that integrates with the Figma API. It uses `@modelcontextprotocol/sdk` for the MCP server implementation and `axios` for HTTP requests to Figma.

### Source Structure

```
src/
├── index.ts              # MCP server entry, tool registration, request handlers
├── figma-service.ts      # Core Figma API client (auth, URL parsing, API calls)
├── image-extractor.ts    # Image export functionality (single/batch)
├── style-extractor.ts    # Style data extraction and CSS generation
└── element-extractor.ts  # Design element analysis (images, vectors, components)

test-svg-export.ts        # Standalone SVG export test tool
```

### Key Patterns

**Service Layer (`figma-service.ts`)**
- `FigmaService` wraps all Figma API interactions
- URL parsing converts Figma URLs to `{fileId, nodeId}` format
- Node ID format conversion: `7905-291614` (URL) → `7905:291614` (API)
- Batch processing with 90 nodes per request to avoid URL limits
- Exponential backoff retry for rate limits and transient errors

**Extractors**
- Each extractor receives `FigmaService` via constructor injection
- `FigmaImageExtractor`: Exports nodes as PNG/JPG/SVG/PDF images
- `FigmaStyleExtractor`: Extracts fills, strokes, effects, text styles; generates CSS
- `FigmaElementExtractor`: Recursively traverses node trees to find images, vectors, components

**MCP Tool Registration (`index.ts`)**
- Tools are defined in `ListToolsRequestSchema` handler with JSON Schema input validation
- Tool execution is handled in `CallToolRequestSchema` handler via switch statement
- All responses follow `{success: boolean, data?: {...}, error?: string}` format

### Security Features

The server implements multiple security measures:

**Input Validation**
- Runtime validation for all handler parameters (URL, format, scale, fileId, nodeIds)
- URL must be valid HTTPS Figma URLs (`*.figma.com`)
- Scale limited to 0.01-4 range
- Node IDs array limited to 500 items

**SSRF Protection**
- Allowlist of trusted Figma domains for external resource fetching
- Only HTTPS URLs permitted

**Response Size Limits**
- SVG responses capped at 1MB (`MAX_SVG_SIZE_BYTES`)
- Prevents memory exhaustion from large exports

**Recursion Depth Limit**
- Node tree traversal limited to 100 levels (`MAX_RECURSION_DEPTH`)
- Prevents stack overflow from deeply nested structures

**Error Sanitization**
- Internal error details logged to stderr only
- Client responses receive sanitized, categorized error messages
- Prevents information leakage about server internals

### Available MCP Tools

1. `get_figma_image` - Export single node as image
2. `get_figma_styles` - Get style data with optional CSS generation
3. `export_multiple_images` - Batch export nodes
4. `get_file_info` - Get file metadata
5. `get_node_images` - Extract embedded image assets from node tree
6. `get_node_svg` - Get SVG code for a node
7. `extract_node_elements` - Analyze all design elements (images, vectors, components)

### TypeScript Configuration

- Target: ES2022, Module: ESNext
- Output directory: `build/`
- Strict mode enabled
- ESM module format (`"type": "module"` in package.json)

### Node.js Requirements

- Node.js >= 18.0.0
