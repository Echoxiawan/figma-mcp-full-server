#!/usr/bin/env npx tsx
/**
 * Standalone test for SVG export functionality
 *
 * Usage:
 *   FIGMA_TOKEN=figd_xxx npx tsx test-svg-export.ts "<figma-url>" [options]
 *
 * Options:
 *   --full, -f       Output full SVG (no truncation)
 *   --output, -o     Save SVG to file (e.g., --output=output.svg)
 *   --help, -h       Show help
 *
 * Examples:
 *   npx tsx test-svg-export.ts "https://www.figma.com/design/XXX/YYY?node-id=123-456"
 *   npx tsx test-svg-export.ts "https://www.figma.com/design/XXX/YYY?node-id=123-456" --full
 *   npx tsx test-svg-export.ts "https://www.figma.com/design/XXX/YYY?node-id=123-456" -o=icon.svg
 */

import { FigmaService } from "./src/figma-service.js";
import { writeFileSync } from "fs";

interface Options {
  figmaUrl: string | null;
  fullOutput: boolean;
  outputFile: string | null;
  showHelp: boolean;
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    figmaUrl: null,
    fullOutput: false,
    outputFile: null,
    showHelp: false,
  };

  for (const arg of args) {
    if (arg === "--full" || arg === "-f") {
      options.fullOutput = true;
    } else if (arg.startsWith("--output=") || arg.startsWith("-o=")) {
      options.outputFile = arg.split("=")[1];
    } else if (arg === "--help" || arg === "-h") {
      options.showHelp = true;
    } else if (!arg.startsWith("-")) {
      options.figmaUrl = arg;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
SVG Export Test - Standalone test tool for Figma SVG export

Usage:
  FIGMA_TOKEN=figd_xxx npx tsx test-svg-export.ts "<figma-url>" [options]

Options:
  --full, -f              Output full SVG (no truncation)
  --output=FILE, -o=FILE  Save SVG to file
  --help, -h              Show this help

Environment Variables:
  FIGMA_TOKEN        Figma Personal Access Token (required)

Examples:
  # Preview mode (first 500 chars)
  npx tsx test-svg-export.ts "https://www.figma.com/design/xxx/yyy?node-id=1-2"

  # Full output
  npx tsx test-svg-export.ts "https://www.figma.com/design/xxx/yyy?node-id=1-2" --full

  # Save to file
  npx tsx test-svg-export.ts "https://www.figma.com/design/xxx/yyy?node-id=1-2" -o=output.svg

  # Full output and save to file
  npx tsx test-svg-export.ts "https://www.figma.com/design/xxx/yyy?node-id=1-2" --full -o=output.svg
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = process.env.FIGMA_TOKEN;

  if (options.showHelp) {
    showHelp();
    process.exit(0);
  }

  if (!token) {
    console.error("Error: FIGMA_TOKEN environment variable is required");
    console.error(
      'Usage: FIGMA_TOKEN=figd_xxx npx tsx test-svg-export.ts "<figma-url>" [options]',
    );
    console.error("Run with --help for more information.");
    process.exit(1);
  }

  if (!options.figmaUrl) {
    console.error("Error: Figma URL is required");
    console.error(
      'Usage: FIGMA_TOKEN=figd_xxx npx tsx test-svg-export.ts "<figma-url>" [options]',
    );
    console.error("Run with --help for more information.");
    process.exit(1);
  }

  console.log("=== SVG Export Test ===\n");

  const service = new FigmaService(token);

  try {
    // Parse URL
    const urlInfo = service.parseUrl(options.figmaUrl);
    console.log("File ID:", urlInfo.fileId);
    console.log("Node ID:", urlInfo.nodeId);
    console.log("Options:", {
      fullOutput: options.fullOutput,
      outputFile: options.outputFile || "(none)",
    });
    console.log();

    if (!urlInfo.nodeId) {
      console.error("Error: URL must contain node-id parameter");
      process.exit(1);
    }

    // Get SVG
    console.log("Fetching SVG...\n");
    const svgData = await service.getNodeAsSVG(urlInfo.fileId, urlInfo.nodeId);

    console.log("=== Result ===");
    console.log("SVG Length:", svgData.length, "characters");
    console.log("SVG Size:", Buffer.byteLength(svgData, "utf8"), "bytes");
    console.log();

    // Save to file if requested
    if (options.outputFile) {
      writeFileSync(options.outputFile, svgData, "utf8");
      console.log(`SVG saved to: ${options.outputFile}`);
      console.log();
    }

    // Display SVG content
    if (options.fullOutput) {
      console.log("=== SVG Full Content ===");
      console.log(svgData);
    } else {
      console.log("=== SVG Preview (first 500 chars) ===");
      console.log(svgData.substring(0, 500));
      if (svgData.length > 500) {
        console.log("...(truncated, use --full to see complete SVG)");
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
