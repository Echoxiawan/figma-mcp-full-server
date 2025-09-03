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
            throw new Error(`未知的工具: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
            },
          ],
        };
      }
    });
  }

  private async handleGetImage(args: any) {
    const { url, format = 'png', scale = 1 } = args;

    try {
      console.error(`开始处理图片请求: ${url}`);
      
      const options: ImageExportOptions = { format, scale };
      const results = await this.imageExtractor.getImageFromUrl(url, options);

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
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`图片获取失败: ${errorMessage}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage,
              troubleshooting: {
                commonIssues: [
                  '检查Figma URL是否包含node-id参数',
                  '确认Figma token是否有效',
                  '验证对该文件是否有访问权限',
                  '检查节点是否存在且可见'
                ],
                urlFormat: 'https://www.figma.com/design/{fileId}/{name}?node-id={nodeId}'
              }
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleGetStyles(args: any) {
    const { url, generateCSS = false } = args;

    const styleData = await this.styleExtractor.getStylesFromUrl(url);

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

  private async handleExportMultipleImages(args: any) {
    const { fileId, nodeIds, format = 'png', scale = 1 } = args;

    const options: ImageExportOptions = { format, scale };
    const results = await this.imageExtractor.getMultipleImages(fileId, nodeIds, options);

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

  private async handleGetFileInfo(args: any) {
    const { url } = args;

    const urlInfo = this.figmaService.parseUrl(url);
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

  private async handleGetNodeImages(args: any) {
    const { url } = args;

    try {
      console.error(`开始获取节点图片资源: ${url}`);
      
      const images = await this.elementExtractor.getNodeImages(
        this.figmaService.parseUrl(url).fileId,
        this.figmaService.parseUrl(url).nodeId!
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
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`获取节点图片失败: ${errorMessage}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage,
              troubleshooting: {
                commonIssues: [
                  '检查Figma URL是否包含node-id参数',
                  '确认节点中是否包含图片资源',
                  '验证对该文件是否有访问权限',
                ],
                urlFormat: 'https://www.figma.com/design/{fileId}/{name}?node-id={nodeId}'
              }
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleGetNodeSVG(args: any) {
    const { url } = args;

    try {
      console.error(`开始获取节点SVG数据: ${url}`);
      
      const urlInfo = this.figmaService.parseUrl(url);
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
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`获取SVG数据失败: ${errorMessage}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage,
              troubleshooting: {
                commonIssues: [
                  '检查节点是否为矢量图形或可导出为SVG',
                  '确认Figma token权限是否充足',
                  '验证节点ID格式是否正确',
                ],
              }
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleExtractNodeElements(args: any) {
    const { url, includeDetails = false } = args;

    try {
      console.error(`开始提取节点设计元素: ${url}`);
      
      const elements = await this.elementExtractor.getElementsFromUrl(url);
      
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
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`提取设计元素失败: ${errorMessage}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage,
              troubleshooting: {
                commonIssues: [
                  '检查Figma URL是否包含node-id参数',
                  '确认对该文件和节点有访问权限',
                  '验证节点是否存在且包含设计元素',
                ],
                tip: '使用includeDetails=true获取详细的元素信息'
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
  const accessToken = process.argv[2] || process.env.FIGMA_TOKEN;
  
  if (!accessToken) {
    console.error('错误: 缺少Figma访问令牌');
    console.error('使用方法: node build/index.js <FIGMA_ACCESS_TOKEN>');
    console.error('或设置环境变量: FIGMA_TOKEN');
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
