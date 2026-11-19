#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { FigmaService } from './figma-service.js';
import { FigmaImageExtractor, ImageExportOptions } from './image-extractor.js';
import { FigmaStyleExtractor } from './style-extractor.js';
import { FigmaElementExtractor } from './element-extractor.js';

// ============================================================================
// Input Validation (Security: Runtime validation for all user inputs)
// ============================================================================

const VALID_FORMATS = ['png', 'jpg', 'svg', 'pdf'] as const;
type ImageFormat = typeof VALID_FORMATS[number];

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateUrl(url: unknown): ValidationResult {
  if (typeof url !== 'string') {
    return { valid: false, error: 'URL must be a string' };
  }
  if (!url.trim()) {
    return { valid: false, error: 'URL cannot be empty' };
  }
  try {
    const parsed = new URL(url);
    // Only allow Figma URLs
    if (!parsed.hostname.endsWith('figma.com')) {
      return { valid: false, error: 'URL must be a valid Figma URL (*.figma.com)' };
    }
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use HTTPS' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

function validateFormat(format: unknown): ValidationResult {
  if (format === undefined) {
    return { valid: true }; // Optional, will use default
  }
  if (typeof format !== 'string') {
    return { valid: false, error: 'Format must be a string' };
  }
  if (!VALID_FORMATS.includes(format as ImageFormat)) {
    return { valid: false, error: `Format must be one of: ${VALID_FORMATS.join(', ')}` };
  }
  return { valid: true };
}

function validateScale(scale: unknown): ValidationResult {
  if (scale === undefined) {
    return { valid: true }; // Optional, will use default
  }
  if (typeof scale !== 'number') {
    return { valid: false, error: 'Scale must be a number' };
  }
  if (scale < 0.01 || scale > 4) {
    return { valid: false, error: 'Scale must be between 0.01 and 4' };
  }
  if (!Number.isFinite(scale)) {
    return { valid: false, error: 'Scale must be a finite number' };
  }
  return { valid: true };
}

function validateFileId(fileId: unknown): ValidationResult {
  if (typeof fileId !== 'string') {
    return { valid: false, error: 'File ID must be a string' };
  }
  if (!fileId.trim()) {
    return { valid: false, error: 'File ID cannot be empty' };
  }
  // Figma file IDs are alphanumeric
  if (!/^[a-zA-Z0-9]+$/.test(fileId)) {
    return { valid: false, error: 'File ID contains invalid characters' };
  }
  return { valid: true };
}

function validateNodeIds(nodeIds: unknown): ValidationResult {
  if (!Array.isArray(nodeIds)) {
    return { valid: false, error: 'Node IDs must be an array' };
  }
  if (nodeIds.length === 0) {
    return { valid: false, error: 'Node IDs array cannot be empty' };
  }
  if (nodeIds.length > 500) {
    return { valid: false, error: 'Too many node IDs (maximum 500)' };
  }
  for (let i = 0; i < nodeIds.length; i++) {
    if (typeof nodeIds[i] !== 'string') {
      return { valid: false, error: `Node ID at index ${i} must be a string` };
    }
    if (!nodeIds[i].trim()) {
      return { valid: false, error: `Node ID at index ${i} cannot be empty` };
    }
  }
  return { valid: true };
}

function validateBoolean(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined) {
    return { valid: true }; // Optional
  }
  if (typeof value !== 'boolean') {
    return { valid: false, error: `${fieldName} must be a boolean` };
  }
  return { valid: true };
}

// Helper to run multiple validations and return first error
function runValidations(...validations: ValidationResult[]): string | null {
  for (const result of validations) {
    if (!result.valid) {
      return result.error || 'Validation failed';
    }
  }
  return null;
}

// ============================================================================
// Error Sanitization (Security: Hide internal details from client responses)
// ============================================================================

// Error codes for categorization (logged internally, not exposed)
enum ErrorCategory {
  AUTHENTICATION = 'AUTH',
  PERMISSION = 'PERMISSION',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN',
}

interface SanitizedError {
  userMessage: string;
  category: ErrorCategory;
}

function categorizeError(error: unknown): SanitizedError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Check for specific error patterns and map to safe messages
  if (lowerMessage.includes('403') || lowerMessage.includes('access denied') || lowerMessage.includes('访问被拒绝')) {
    return {
      userMessage: 'Access denied. Please check your Figma token and file permissions.',
      category: ErrorCategory.PERMISSION,
    };
  }

  if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized') || lowerMessage.includes('invalid token')) {
    return {
      userMessage: 'Authentication failed. Please verify your Figma access token.',
      category: ErrorCategory.AUTHENTICATION,
    };
  }

  if (lowerMessage.includes('404') || lowerMessage.includes('not found') || lowerMessage.includes('未找到')) {
    return {
      userMessage: 'Resource not found. Please verify the file ID and node ID are correct.',
      category: ErrorCategory.NOT_FOUND,
    };
  }

  if (lowerMessage.includes('429') || lowerMessage.includes('rate limit') || lowerMessage.includes('too many')) {
    return {
      userMessage: 'Rate limit exceeded. Please wait a moment and try again.',
      category: ErrorCategory.RATE_LIMIT,
    };
  }

  if (lowerMessage.includes('500') || lowerMessage.includes('502') || lowerMessage.includes('503') || lowerMessage.includes('504')) {
    return {
      userMessage: 'Figma service is temporarily unavailable. Please try again later.',
      category: ErrorCategory.SERVER_ERROR,
    };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('timeout') || lowerMessage.includes('econnrefused')) {
    return {
      userMessage: 'Network error. Please check your connection and try again.',
      category: ErrorCategory.NETWORK,
    };
  }

  if (lowerMessage.includes('security:')) {
    // Security errors from our validation (safe to pass through)
    return {
      userMessage: errorMessage.replace(/^security:\s*/i, ''),
      category: ErrorCategory.VALIDATION,
    };
  }

  if (lowerMessage.includes('node-id') || lowerMessage.includes('url') || lowerMessage.includes('format')) {
    return {
      userMessage: 'Invalid request parameters. Please check the URL format and parameters.',
      category: ErrorCategory.VALIDATION,
    };
  }

  // Default: generic error (don't expose internal details)
  return {
    userMessage: 'An error occurred while processing your request. Please try again.',
    category: ErrorCategory.UNKNOWN,
  };
}

function sanitizeErrorForResponse(error: unknown, operationContext: string): string {
  // Log full error details to stderr for debugging (not visible to client)
  const fullError = error instanceof Error ? error.message : String(error);
  console.error(`[${operationContext}] Error details (internal): ${fullError}`);

  // Return sanitized message
  const { userMessage, category } = categorizeError(error);
  console.error(`[${operationContext}] Category: ${category}`);

  return userMessage;
}

class FigmaMCPServer {
  private server: Server;
  private figmaService: FigmaService;
  private imageExtractor: FigmaImageExtractor;
  private styleExtractor: FigmaStyleExtractor;
  private elementExtractor: FigmaElementExtractor;

  constructor(accessToken: string) {
    this.server = new Server(
      {
        name: 'figma-mcp-full-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.figmaService = new FigmaService(accessToken);
    this.imageExtractor = new FigmaImageExtractor(this.figmaService);
    this.styleExtractor = new FigmaStyleExtractor(this.figmaService);
    this.elementExtractor = new FigmaElementExtractor(this.figmaService);

    this.setupHandlers();
  }

  private setupHandlers() {
    // 注册工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_figma_image',
            description: '根据Figma URL获取节点的图片',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Figma文件URL，必须包含node-id参数',
                },
                format: {
                  type: 'string',
                  enum: ['png', 'jpg', 'svg', 'pdf'],
                  description: '图片格式，默认为png',
                  default: 'png',
                },
                scale: {
                  type: 'number',
                  description: '图片缩放比例，默认为1',
                  default: 1,
                  minimum: 0.01,
                  maximum: 4,
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'get_figma_styles',
            description: '根据Figma URL获取节点的样式数据',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Figma文件URL，可以包含node-id参数指定特定节点',
                },
                generateCSS: {
                  type: 'boolean',
                  description: '是否生成CSS代码',
                  default: false,
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'export_multiple_images',
            description: '批量导出多个节点的图片',
            inputSchema: {
              type: 'object',
              properties: {
                fileId: {
                  type: 'string',
                  description: 'Figma文件ID',
                },
                nodeIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '节点ID列表',
                },
                format: {
                  type: 'string',
                  enum: ['png', 'jpg', 'svg', 'pdf'],
                  description: '图片格式，默认为png',
                  default: 'png',
                },
                scale: {
                  type: 'number',
                  description: '图片缩放比例，默认为1',
                  default: 1,
                  minimum: 0.01,
                  maximum: 4,
                },
              },
              required: ['fileId', 'nodeIds'],
            },
          },
          {
            name: 'get_file_info',
            description: '获取Figma文件的基本信息',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Figma文件URL',
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'get_node_images',
            description: '获取节点中的所有图片资源',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Figma文件URL，必须包含node-id参数',
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'get_node_svg',
            description: '获取节点的SVG数据',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Figma文件URL，必须包含node-id参数',
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'extract_node_elements',
            description: '提取节点中的所有设计元素（图片、矢量、组件）',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Figma文件URL，必须包含node-id参数',
                },
                includeDetails: {
                  type: 'boolean',
                  description: '是否包含详细信息，默认为false',
                  default: false,
                },
              },
              required: ['url'],
            },
          },
        ],
      };
    });

    // 注册工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_figma_image':
            return await this.handleGetImage(args);

          case 'get_figma_styles':
            return await this.handleGetStyles(args);

          case 'export_multiple_images':
            return await this.handleExportMultipleImages(args);

          case 'get_file_info':
            return await this.handleGetFileInfo(args);

          case 'get_node_images':
            return await this.handleGetNodeImages(args);

          case 'get_node_svg':
            return await this.handleGetNodeSVG(args);

          case 'extract_node_elements':
            return await this.handleExtractNodeElements(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const sanitizedMessage = sanitizeErrorForResponse(error, `tool:${name}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: sanitizedMessage }, null, 2),
            },
          ],
        };
      }
    });
  }

  private async handleGetImage(args: unknown) {
    const params = args as Record<string, unknown>;
    const url = params.url;
    const format = (params.format ?? 'png') as ImageFormat;
    const scale = (params.scale ?? 1) as number;

    // Validate inputs
    const validationError = runValidations(
      validateUrl(url),
      validateFormat(params.format),
      validateScale(params.scale)
    );
    if (validationError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: validationError }, null, 2) }],
      };
    }

    try {
      console.error(`Processing image request`);

      const options: ImageExportOptions = { format, scale };
      const results = await this.imageExtractor.getImageFromUrl(url as string, options);

      if (results.length === 0) {
        throw new Error('未找到可导出的图片');
      }

      const result = results[0];
      console.error(`图片导出成功: ${result.nodeName} (${result.nodeId})`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                imageUrl: result.url,
                nodeId: result.nodeId,
                nodeName: result.nodeName,
                format: result.format,
                scale: result.scale,
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const sanitizedMessage = sanitizeErrorForResponse(error, 'get_figma_image');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizedMessage,
              troubleshooting: {
                commonIssues: [
                  'Ensure the Figma URL contains a node-id parameter',
                  'Verify your Figma token is valid',
                  'Check that you have access to the file',
                  'Confirm the node exists and is visible'
                ],
                urlFormat: 'https://www.figma.com/design/{fileId}/{name}?node-id={nodeId}'
              }
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleGetStyles(args: unknown) {
    const params = args as Record<string, unknown>;
    const url = params.url;
    const generateCSS = (params.generateCSS ?? false) as boolean;

    // Validate inputs
    const validationError = runValidations(
      validateUrl(url),
      validateBoolean(params.generateCSS, 'generateCSS')
    );
    if (validationError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: validationError }, null, 2) }],
      };
    }

    const styleData = await this.styleExtractor.getStylesFromUrl(url as string);

    let cssCode = '';
    if (generateCSS && styleData.styles.length > 0) {
      const cssRules = styleData.styles.map(style => {
        const selector = `.${style.nodeName.toLowerCase().replace(/\\s+/g, '-')}`;
        const css = this.styleExtractor.generateCSS(style);
        return css ? `${selector} {\\n  ${css}\\n}` : '';
      }).filter(rule => rule);

      cssCode = cssRules.join('\\n\\n');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              fileInfo: styleData.fileInfo,
              styles: styleData.styles,
              globalStyles: styleData.globalStyles,
              ...(cssCode && { generatedCSS: cssCode }),
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleExportMultipleImages(args: unknown) {
    const params = args as Record<string, unknown>;
    const fileId = params.fileId;
    const nodeIds = params.nodeIds;
    const format = (params.format ?? 'png') as ImageFormat;
    const scale = (params.scale ?? 1) as number;

    // Validate inputs
    const validationError = runValidations(
      validateFileId(fileId),
      validateNodeIds(nodeIds),
      validateFormat(params.format),
      validateScale(params.scale)
    );
    if (validationError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: validationError }, null, 2) }],
      };
    }

    const options: ImageExportOptions = { format, scale };
    const results = await this.imageExtractor.getMultipleImages(fileId as string, nodeIds as string[], options);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              images: results,
              totalCount: results.length,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetFileInfo(args: unknown) {
    const params = args as Record<string, unknown>;
    const url = params.url;

    // Validate inputs
    const validationError = runValidations(validateUrl(url));
    if (validationError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: validationError }, null, 2) }],
      };
    }

    const urlInfo = this.figmaService.parseUrl(url as string);
    const file = await this.figmaService.getFile(urlInfo.fileId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              fileId: urlInfo.fileId,
              fileName: file.name,
              lastModified: file.lastModified,
              version: file.version,
              componentsCount: Object.keys(file.components || {}).length,
              stylesCount: Object.keys(file.styles || {}).length,
              pagesCount: file.document.children?.length || 0,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetNodeImages(args: unknown) {
    const params = args as Record<string, unknown>;
    const url = params.url;

    // Validate inputs
    const validationError = runValidations(validateUrl(url));
    if (validationError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: validationError }, null, 2) }],
      };
    }

    try {
      console.error(`Processing node images request`);

      const urlInfo = this.figmaService.parseUrl(url as string);
      const images = await this.elementExtractor.getNodeImages(
        urlInfo.fileId,
        urlInfo.nodeId!
      );

      console.error(`成功获取 ${images.length} 个图片资源`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                images,
                totalCount: images.length,
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const sanitizedMessage = sanitizeErrorForResponse(error, 'get_node_images');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizedMessage,
              troubleshooting: {
                commonIssues: [
                  'Ensure the Figma URL contains a node-id parameter',
                  'Confirm the node contains image resources',
                  'Verify you have access to the file',
                ],
                urlFormat: 'https://www.figma.com/design/{fileId}/{name}?node-id={nodeId}'
              }
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleGetNodeSVG(args: unknown) {
    const params = args as Record<string, unknown>;
    const url = params.url;

    // Validate inputs
    const validationError = runValidations(validateUrl(url));
    if (validationError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: validationError }, null, 2) }],
      };
    }

    try {
      console.error(`Processing SVG request`);

      const urlInfo = this.figmaService.parseUrl(url as string);
      if (!urlInfo.nodeId) {
        throw new Error('URL中缺少node-id参数');
      }

      const svgData = await this.elementExtractor.getNodeAsSVG(urlInfo.fileId, urlInfo.nodeId);

      console.error(`成功获取SVG数据，长度: ${svgData.length} 字符`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                svg: svgData,
                fileId: urlInfo.fileId,
                nodeId: urlInfo.nodeId,
                dataLength: svgData.length,
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      const sanitizedMessage = sanitizeErrorForResponse(error, 'get_node_svg');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizedMessage,
              troubleshooting: {
                commonIssues: [
                  'Ensure the node is a vector graphic or exportable as SVG',
                  'Verify your Figma token has sufficient permissions',
                  'Check that the node ID format is correct',
                ],
              }
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleExtractNodeElements(args: unknown) {
    const params = args as Record<string, unknown>;
    const url = params.url;
    const includeDetails = (params.includeDetails ?? false) as boolean;

    // Validate inputs
    const validationError = runValidations(
      validateUrl(url),
      validateBoolean(params.includeDetails, 'includeDetails')
    );
    if (validationError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: validationError }, null, 2) }],
      };
    }

    try {
      console.error(`Processing element extraction request`);

      const elements = await this.elementExtractor.getElementsFromUrl(url as string);
      
      console.error(`成功提取设计元素: ${elements.totalElements} 个`);
      
      const responseData: any = {
        success: true,
        data: {
          nodeId: elements.nodeId,
          nodeName: elements.nodeName,
          summary: {
            totalElements: elements.totalElements,
            images: elements.images.length,
            vectors: elements.vectors.length,
            components: elements.components.length,
          },
          elements: includeDetails ? {
            images: elements.images,
            vectors: elements.vectors,
            components: elements.components,
          } : undefined,
        },
      };

      // 如果不包含详细信息，提供可读的摘要
      if (!includeDetails) {
        responseData.data.textSummary = this.elementExtractor.generateElementsSummary(elements);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(responseData, null, 2),
          },
        ],
      };
    } catch (error) {
      const sanitizedMessage = sanitizeErrorForResponse(error, 'extract_node_elements');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: sanitizedMessage,
              troubleshooting: {
                commonIssues: [
                  'Ensure the Figma URL contains a node-id parameter',
                  'Verify you have access to the file and node',
                  'Confirm the node exists and contains design elements',
                ],
                tip: 'Use includeDetails=true to get detailed element information'
              }
            }, null, 2),
          },
        ],
      };
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Figma MCP服务器已启动');
  }
}

// 启动服务器
async function main() {
  // Security: Only use environment variable for token to prevent exposure in process listings
  const accessToken = process.env.FIGMA_TOKEN;

  if (!accessToken) {
    console.error('Error: Missing Figma access token');
    console.error('Please set the FIGMA_TOKEN environment variable');
    process.exit(1);
  }

  try {
    const server = new FigmaMCPServer(accessToken);
    await server.start();
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

main().catch(console.error);
