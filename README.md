# Figma MCP Tool

English | [简体中文](README.zh-CN.md)

A Model Context Protocol (MCP) server that integrates with the Figma API to export images and extract style data.

## Features

- 🖼️ **Image export**: Export node images from a Figma URL; supports PNG, JPG, SVG, PDF
- 🎨 **Style extraction**: Fetch detailed style data for design elements; supports CSS generation
- 📦 **Batch export**: Export multiple nodes in one go
- 🔄 **Smart retry**: Built-in retry to handle network hiccups and API limits
- 🛡️ **Robust errors**: Clear error handling and troubleshooting guidance
- 🧩 **Design element analysis**: Deeply analyze images, vectors, components in designs 🆕
- 📋 **SVG extraction**: Get SVG code for vector graphics directly 🆕

## Install and Run

> **Security Note**: The Figma token must be provided via the `FIGMA_TOKEN` environment variable. Command-line arguments are not supported to prevent token exposure in process listings and shell history.

### Option 1: Run via npx (recommended, no install)

```bash
FIGMA_TOKEN=figd_your_figma_token_here npx figma-mcp-full-server
```

### Option 2: Global install

```bash
# Install globally
npm install -g figma-mcp-full-server

# Run
FIGMA_TOKEN=figd_your_figma_token_here figma-mcp-full-server
```

### Option 3: Local project install

```bash
# Install in your project
npm install figma-mcp-full-server

# Run
FIGMA_TOKEN=figd_your_figma_token_here npx figma-mcp-full-server
```

### Option 4: Run from source (for development)

```bash
git clone <repository>
cd figma-mcp
npm install
npm run build

# Run
export FIGMA_TOKEN=figd_your_figma_token_here
npm start
# or
node build/index.js
```

## Quick Start

### 1. Get a Figma access token

1. Log in to [Figma](https://figma.com)
2. Go to **Settings** → **Security**
3. Find the **Personal access tokens** section
4. Click **Generate new token**
5. Enter a token name (e.g., "MCP Server")
6. **Set the required scopes** (see below)
7. Click **Generate token**
8. Copy the token (starts with `figd_`)

#### Required Scopes

| Scope | Required | Description |
|-------|----------|-------------|
| `file_content:read` | ✅ Yes | Read file contents, nodes, and export images |

This MCP server uses the following Figma API endpoints, all requiring `file_content:read`:
- `GET /v1/files/:file_key` — Get file data
- `GET /v1/files/:file_key/nodes` — Get specific node data
- `GET /v1/files/:file_key/images` — Get image fill references
- `GET /v1/images/:file_key` — Export images (PNG/JPG/SVG/PDF)

> **Note**: The deprecated `files:read` scope also works but is not recommended. Use `file_content:read` for better security.

### 2. Configure in Claude Desktop

Edit the Claude config file (pick your OS):

macOS/Linux: `~/.config/claude-desktop/config.json`  
Windows: `%APPDATA%\Claude Desktop\config.json`

Choose one of the following setups:

#### Setup A: Run via npx (recommended)

```json
{
  "mcpServers": {
    "figma-mcp-full-server": {
      "command": "npx",
      "args": ["figma-mcp-full-server"],
      "env": {
        "FIGMA_TOKEN": "figd_your_figma_token_here"
      }
    }
  }
}
```

#### Setup B: Global install

```bash
npm install -g figma-mcp-full-server
```

```json
{
  "mcpServers": {
    "figma-mcp-full-server": {
      "command": "figma-mcp-full-server",
      "env": {
        "FIGMA_TOKEN": "figd_your_figma_token_here"
      }
    }
  }
}
```

#### Setup C: Use from a project

```bash
npm install figma-mcp-full-server
```

```json
{
  "mcpServers": {
    "figma-mcp-full-server": {
      "command": "npx",
      "args": ["figma-mcp-full-server"],
      "cwd": "/path/to/your/project",
      "env": {
        "FIGMA_TOKEN": "figd_your_figma_token_here"
      }
    }
  }
}
```

#### Setup D: Run from source

```json
{
  "mcpServers": {
    "figma-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/figma-mcp/build/index.js"
      ],
      "cwd": "/absolute/path/to/figma-mcp",
      "env": {
        "FIGMA_TOKEN": "figd_your_figma_token_here"
      }
    }
  }
}
```

⚠️ Notes:
- Recommended: Setup A (npx) — no install, always latest
- Global install: good if you use it often
- Project install: pin a version per project
- From source: for development and customization
- Replace `figd_your_figma_token_here` with your real Figma token

### 3. Restart Claude Desktop

Restart Claude Desktop to apply the config.

## Usage

Once configured, use it directly in Claude:

### Get Figma images

```
Please fetch images from this Figma URL:
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name?node-id=123-456&t=abc123-0
```

### Get style data and generate CSS

```
Please get style data from this design and generate CSS:
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name?node-id=123-456&t=abc123-0
```

### Get file info

```
Please show the basic info for this Figma file:
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name
```

### Get design elements 🆕

```
Please analyze what design elements this Figma node contains:
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name?node-id=123-456&t=abc123-0
```

### Get image assets 🆕

```
Please extract all image assets under this Figma node:
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name?node-id=123-456&t=abc123-0
```

### Get SVG data 🆕

```
Please get the SVG code for this Figma node:
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name?node-id=123-456&t=abc123-0
```

## Available Tools

This MCP server provides 7 tools:

### Basics
1. **get_figma_image** — Get node image by Figma URL
2. **get_figma_styles** — Get node style data; optional CSS output
3. **export_multiple_images** — Batch export multiple nodes
4. **get_file_info** — Get basic file info

### Design element tools 🆕
5. **get_node_images** — Get all image assets under a node
6. **get_node_svg** — Get SVG data for a node
7. **extract_node_elements** — Extract all design elements (images, vectors, components)

## Troubleshooting

### Common issues

#### 1. "Cannot find module"
- Cause: Using a `.ts` entry instead of the built `.js`
- Fix: Use `/path/to/build/index.js` instead of `index.ts`

#### 2. "Access denied"
- Cause: Invalid Figma token or insufficient file permission
- Fix: Verify token, ensure file is public or accessible

#### 3. MCP server won’t start
- Cause: Wrong paths or Node.js version too low
- Fix:
  - Use absolute paths
  - Ensure Node.js ≥ 18
  - Rebuild: `npm run build`

#### 4. "No exportable images found"
- Cause: URL missing `node-id` parameter
- Fix: Ensure URL includes `?node-id=xxxxx-xxxxx`

### Manual test

```bash
cd /path/to/figma-mcp
FIGMA_TOKEN=figd_your_token_here node build/index.js
```

You should see: `Figma MCP server started`

### Validate config

```bash
# macOS/Linux
cat ~/.config/claude-desktop/config.json | python -m json.tool

# Windows
type "%APPDATA%\Claude Desktop\config.json" | python -m json.tool
```

## Technical Details

### Smart retry
- Handles transient network issues automatically
- Exponential backoff
- Error classification and recovery

### Batch processing
- Automatically splits large node sets (90 per batch)
- Avoids URL length limits
- Concurrency control and resource management

### Error handling
- Detailed messages and remediation tips
- Friendly feedback
- Complete logging

## Development

### Dev mode

```bash
npm run dev
# Then set FIGMA_TOKEN in your environment
```

### Project structure

```
figma-mcp/
├── src/
│   ├── index.ts             # MCP server entry
│   ├── figma-service.ts     # Figma API service
│   ├── image-extractor.ts   # Image export
│   ├── style-extractor.ts   # Style extraction
│   └── element-extractor.ts # Design element extraction 🆕
├── build/                   # Build output
├── package.json
└── README.md
```

## New Features 🆕

### Design element analysis
- **Image asset recognition**: Find all images, including embedded and external
- **Vector extraction**: Extract SVG paths, shapes, icons
- **Component analysis**: Identify components and instances
- **Hierarchy traversal**: Deeply walk the node tree

### SVG data
- **Full SVG export**: Complete SVG code with styles and paths
- **Vector fidelity**: Preserve vector properties for lossless scaling
- **Inline styles**: SVG contains complete styles, ready to use

### Smart element detection
- **Auto categorization**: Images, vectors, text, components
- **De-duplication**: Remove duplicate resource references
- **Detail control**: Overview vs detailed output modes

## Security Best Practices

1. **Token safety**: Use env vars for the Figma token; never hardcode
2. **Access control**: Rotate tokens regularly
3. **Least privilege**: Grant the minimum required file access

## License

MIT License

---

## Support

If you run into issues:
1. Ensure Node.js ≥ 18
2. Verify your Figma token
3. Validate your JSON config
4. Check Claude Desktop logs
5. Manually start the MCP server

Once configured, you can use Figma files directly in Claude!

### Contact

<img src="contact.JPG" alt="Contact" width="360" />

<img src="程序员热榜.jpg" alt="程序员热榜公众号" width="360" />
