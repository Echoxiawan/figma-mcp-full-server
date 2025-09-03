import axios, { AxiosInstance } from 'axios';

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  fills?: any[];
  strokes?: any[];
  strokeWeight?: number;
  cornerRadius?: number;
  effects?: any[];
  constraints?: any;
  componentId?: string; // 添加组件ID属性
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    letterSpacing?: number;
    lineHeightPx?: number;
    textAlignHorizontal?: string;
    textAlignVertical?: string;
  };
  children?: FigmaNode[];
}

export interface FigmaFile {
  name: string;
  lastModified: string;
  version: string;
  document: FigmaNode;
  components: Record<string, any>;
  styles: Record<string, any>;
}

export interface FigmaUrlInfo {
  fileId: string;
  nodeId?: string;
}

export interface ImageResource {
  id: string;
  name: string;
  url?: string;
  type: 'EMBEDDED' | 'EXTERNAL';
  format?: string;
  size?: {
    width: number;
    height: number;
  };
}

export interface VectorElement {
  id: string;
  name: string;
  type: string;
  svg?: string;
  paths?: string[];
  fills?: any[];
  strokes?: any[];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DesignElement {
  id: string;
  name: string;
  type: 'IMAGE' | 'VECTOR' | 'TEXT' | 'COMPONENT';
  data: ImageResource | VectorElement | any;
}

export interface NodeElements {
  nodeId: string;
  nodeName: string;
  images: ImageResource[];
  vectors: VectorElement[];
  components: any[];
  totalElements: number;
}

export class FigmaService {
  private api: AxiosInstance;

  constructor(private accessToken: string) {
    this.api = axios.create({
      baseURL: 'https://api.figma.com/v1',
      headers: {
        'X-Figma-Token': accessToken,
      },
    });
  }

  /**
   * 解析Figma URL获取文件ID和节点ID
   */
  parseUrl(url: string): FigmaUrlInfo {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // 匹配 /design/{fileId} 或 /file/{fileId}
      const fileMatch = pathname.match(/\/(?:design|file)\/([a-zA-Z0-9]+)/);
      if (!fileMatch) {
        throw new Error('无效的Figma URL格式');
      }

      const fileId = fileMatch[1];
      let nodeId = urlObj.searchParams.get('node-id');

      // 将node-id中的连字符转换为冒号（如：7905-291614 -> 7905:291614）
      if (nodeId) {
        nodeId = decodeURIComponent(nodeId).replace('-', ':');
      }

      return {
        fileId,
        nodeId: nodeId || undefined,
      };
    } catch (error) {
      throw new Error(`解析Figma URL失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取文件信息
   */
  async getFile(fileId: string): Promise<FigmaFile> {
    try {
      const response = await this.api.get(`/files/${fileId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        if (status === 403) {
          throw new Error('访问被拒绝：请检查Figma访问令牌或文件权限');
        } else if (status === 404) {
          throw new Error('文件未找到：请检查文件ID是否正确');
        } else {
          throw new Error(`获取文件失败 (${status}): ${message}`);
        }
      }
      throw new Error(`获取文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取节点的详细信息（包含完整的属性和子树）
   */
  async getNodeDetails(fileId: string, nodeId: string): Promise<FigmaNode | null> {
    try {
      const response = await this.api.get(`/files/${fileId}/nodes`, {
        params: { ids: nodeId },
      });
      
      const nodeData = response.data.nodes[nodeId];
      return nodeData?.document || null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(`获取节点详细信息失败 (${status}): ${message}`);
      }
      throw new Error(`获取节点详细信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取特定节点信息（向后兼容）
   */
  async getNode(fileId: string, nodeId: string): Promise<FigmaNode | null> {
    return this.getNodeDetails(fileId, nodeId);
  }

  /**
   * 递归遍历节点树，收集所有子节点
   */
  traverseNodeTree(node: FigmaNode, collector: (node: FigmaNode) => void) {
    collector(node);
    if (node.children) {
      for (const child of node.children) {
        this.traverseNodeTree(child, collector);
      }
    }
  }

  /**
   * 获取节点的SVG数据
   */
  async getNodeAsSVG(fileId: string, nodeId: string): Promise<string> {
    try {
      const images = await this.exportImage(fileId, [nodeId], { format: 'svg' });
      const svgUrl = images[nodeId];
      
      if (!svgUrl) {
        throw new Error(`无法获取节点 ${nodeId} 的SVG数据`);
      }

      // 下载SVG内容
      const response = await axios.get(svgUrl);
      return response.data;
    } catch (error) {
      throw new Error(`获取SVG数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取文件中的所有图片资源引用
   */
  async getFileImageReferences(fileId: string): Promise<Record<string, any>> {
    try {
      const response = await this.api.get(`/files/${fileId}/images`);
      return response.data.images || {};
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(`获取图片引用失败 (${status}): ${message}`);
      }
      throw new Error(`获取图片引用失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 导出图片
   */
  async exportImage(fileId: string, nodeIds: string[], options: {
    format?: 'jpg' | 'png' | 'svg' | 'pdf';
    scale?: number;
    version?: string;
  } = {}): Promise<Record<string, string>> {
    try {
      // 分批处理，避免URL过长
      const batchSize = 90; // 保守分批
      const allImages: Record<string, string> = {};

      for (let i = 0; i < nodeIds.length; i += batchSize) {
        const batch = nodeIds.slice(i, i + batchSize);
        const batchImages = await this.exportImageBatch(fileId, batch, options);
        Object.assign(allImages, batchImages);
      }

      return allImages;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(`导出图片失败 (${status}): ${message}`);
      }
      throw new Error(`导出图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 导出图片批次（带重试机制）
   */
  private async exportImageBatch(fileId: string, nodeIds: string[], options: {
    format?: 'jpg' | 'png' | 'svg' | 'pdf';
    scale?: number;
    version?: string;
  } = {}, maxRetries: number = 3): Promise<Record<string, string>> {
    const params = {
      ids: nodeIds.join(','),
      format: options.format || 'png',
      scale: options.scale || 1,
      version: options.version,
    };

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.api.get(`/images/${fileId}`, { params });
        
        if (response.data.err) {
          // Figma API返回错误，但HTTP状态是200
          const errorMsg = response.data.err;
          if (attempt < maxRetries && (errorMsg.includes('expired') || errorMsg.includes('timeout'))) {
            console.error(`图片导出尝试 ${attempt}/${maxRetries} 失败: ${errorMsg}，准备重试...`);
            await this.delay(800 + Math.random() * 500); // 随机延迟
            continue;
          }
          throw new Error(`导出图片失败: ${errorMsg}`);
        }

        return response.data.images || {};
      } catch (error) {
        lastError = error as Error;
        
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          
          // 对于429 (rate limit)和5xx错误进行重试
          if (attempt < maxRetries && (status === 429 || (status && status >= 500))) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 指数退避
            console.error(`图片导出尝试 ${attempt}/${maxRetries} 失败: HTTP ${status}，${delay}ms后重试...`);
            await this.delay(delay);
            continue;
          }
        }
        
        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('导出图片失败：未知错误');
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取文件样式
   */
  async getFileStyles(fileId: string): Promise<Record<string, any>> {
    try {
      const file = await this.getFile(fileId);
      return file.styles || {};
    } catch (error) {
      throw new Error(`获取样式失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}