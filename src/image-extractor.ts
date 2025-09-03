import { FigmaService, FigmaUrlInfo } from './figma-service.js';

export interface ImageExportOptions {
  format?: 'jpg' | 'png' | 'svg' | 'pdf';
  scale?: number;
  version?: string;
}

export interface ImageResult {
  url: string;
  nodeId: string;
  nodeName: string;
  format: string;
  scale: number;
}

export class FigmaImageExtractor {
  constructor(private figmaService: FigmaService) {}

  /**
   * 根据Figma URL获取图片
   */
  async getImageFromUrl(
    figmaUrl: string, 
    options: ImageExportOptions = {}
  ): Promise<ImageResult[]> {
    try {
      const urlInfo = this.figmaService.parseUrl(figmaUrl);
      const { fileId, nodeId } = urlInfo;

      if (!nodeId) {
        throw new Error('URL中缺少节点ID，无法导出图片。请确保URL包含node-id参数');
      }

      // 获取节点信息以获取名称
      const nodeInfo = await this.figmaService.getNode(fileId, nodeId);
      if (!nodeInfo) {
        throw new Error(`未找到节点: ${nodeId}`);
      }

      // 导出图片
      const images = await this.figmaService.exportImage(
        fileId, 
        [nodeId], 
        options
      );

      const imageUrl = images[nodeId];
      if (!imageUrl) {
        throw new Error(`无法生成节点 ${nodeId} 的图片URL`);
      }

      return [{
        url: imageUrl,
        nodeId,
        nodeName: nodeInfo.name,
        format: options.format || 'png',
        scale: options.scale || 1,
      }];

    } catch (error) {
      throw new Error(`获取图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 批量导出多个节点的图片
   */
  async getMultipleImages(
    fileId: string,
    nodeIds: string[],
    options: ImageExportOptions = {}
  ): Promise<ImageResult[]> {
    try {
      if (nodeIds.length === 0) {
        return [];
      }

      // 获取所有节点信息
      const nodeInfoPromises = nodeIds.map(nodeId => 
        this.figmaService.getNode(fileId, nodeId)
      );
      const nodeInfos = await Promise.all(nodeInfoPromises);

      // 导出所有图片
      const images = await this.figmaService.exportImage(fileId, nodeIds, options);

      const results: ImageResult[] = [];
      for (let i = 0; i < nodeIds.length; i++) {
        const nodeId = nodeIds[i];
        const nodeInfo = nodeInfos[i];
        const imageUrl = images[nodeId];

        if (imageUrl && nodeInfo) {
          results.push({
            url: imageUrl,
            nodeId,
            nodeName: nodeInfo.name,
            format: options.format || 'png',
            scale: options.scale || 1,
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`批量获取图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取页面中所有可导出的组件图片
   */
  async getPageImages(
    fileId: string,
    pageId?: string,
    options: ImageExportOptions = {}
  ): Promise<ImageResult[]> {
    try {
      const file = await this.figmaService.getFile(fileId);
      
      let targetNode = file.document;
      if (pageId) {
        const page = file.document.children?.find(child => child.id === pageId);
        if (!page) {
          throw new Error(`未找到页面: ${pageId}`);
        }
        targetNode = page;
      }

      // 收集所有可导出的节点（非文本节点，有名称的组件）
      const exportableNodes: string[] = [];
      const collectNodes = (node: any) => {
        if (node.type !== 'TEXT' && node.name && node.visible !== false) {
          exportableNodes.push(node.id);
        }
        if (node.children) {
          node.children.forEach(collectNodes);
        }
      };

      if (targetNode.children) {
        targetNode.children.forEach(collectNodes);
      }

      if (exportableNodes.length === 0) {
        return [];
      }

      // 批量导出图片
      return await this.getMultipleImages(fileId, exportableNodes, options);
    } catch (error) {
      throw new Error(`获取页面图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}