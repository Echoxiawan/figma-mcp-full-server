import { FigmaService, FigmaNode, ImageResource, VectorElement, DesignElement, NodeElements } from './figma-service.js';

export class FigmaElementExtractor {
  constructor(private figmaService: FigmaService) {}

  /**
   * 获取节点中的所有图片资源
   */
  async getNodeImages(fileId: string, nodeId: string): Promise<ImageResource[]> {
    try {
      const node = await this.figmaService.getNodeDetails(fileId, nodeId);
      if (!node) {
        throw new Error(`节点 ${nodeId} 不存在`);
      }

      const images: ImageResource[] = [];
      
      // 递归收集所有包含图片的节点
      this.figmaService.traverseNodeTree(node, (currentNode) => {
        // 检查填充中的图片
        if (currentNode.fills) {
          for (const fill of currentNode.fills) {
            if (fill.type === 'IMAGE' && fill.imageRef) {
              images.push({
                id: fill.imageRef,
                name: currentNode.name || `Image in ${currentNode.id}`,
                type: 'EMBEDDED',
                size: currentNode.absoluteBoundingBox ? {
                  width: currentNode.absoluteBoundingBox.width,
                  height: currentNode.absoluteBoundingBox.height
                } : undefined
              });
            }
          }
        }

        // 检查节点类型是否为图片
        if (currentNode.type === 'RECTANGLE' && currentNode.fills?.some(f => f.type === 'IMAGE')) {
          // 已在上面处理
        }
      });

      // 获取图片的实际URL
      if (images.length > 0) {
        try {
          const imageRefs = await this.figmaService.getFileImageReferences(fileId);
          for (const image of images) {
            if (imageRefs[image.id]) {
              image.url = imageRefs[image.id];
            }
          }
        } catch (error) {
          console.error('获取图片URL失败:', error);
        }
      }

      return this.deduplicateImages(images);
    } catch (error) {
      throw new Error(`获取节点图片失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取节点的SVG数据
   */
  async getNodeAsSVG(fileId: string, nodeId: string): Promise<string> {
    try {
      return await this.figmaService.getNodeAsSVG(fileId, nodeId);
    } catch (error) {
      throw new Error(`获取SVG数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 提取节点中的所有矢量元素
   */
  async extractVectorElements(fileId: string, nodeId: string): Promise<VectorElement[]> {
    try {
      const node = await this.figmaService.getNodeDetails(fileId, nodeId);
      if (!node) {
        throw new Error(`节点 ${nodeId} 不存在`);
      }

      const vectors: VectorElement[] = [];

      // 递归收集所有矢量节点
      this.figmaService.traverseNodeTree(node, (currentNode) => {
        if (this.isVectorNode(currentNode)) {
          vectors.push({
            id: currentNode.id,
            name: currentNode.name || `Vector ${currentNode.id}`,
            type: currentNode.type,
            fills: currentNode.fills,
            strokes: currentNode.strokes,
            boundingBox: currentNode.absoluteBoundingBox ? {
              x: currentNode.absoluteBoundingBox.x,
              y: currentNode.absoluteBoundingBox.y,
              width: currentNode.absoluteBoundingBox.width,
              height: currentNode.absoluteBoundingBox.height
            } : undefined
          });
        }
      });

      return vectors;
    } catch (error) {
      throw new Error(`提取矢量元素失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取节点的所有设计元素（图片+矢量）
   */
  async getAllNodeElements(fileId: string, nodeId: string): Promise<NodeElements> {
    try {
      const node = await this.figmaService.getNodeDetails(fileId, nodeId);
      if (!node) {
        throw new Error(`节点 ${nodeId} 不存在`);
      }

      const [images, vectors] = await Promise.all([
        this.getNodeImages(fileId, nodeId),
        this.extractVectorElements(fileId, nodeId)
      ]);

      // 收集组件节点
      const components: any[] = [];
      this.figmaService.traverseNodeTree(node, (currentNode) => {
        if (currentNode.type === 'COMPONENT' || currentNode.type === 'INSTANCE') {
          components.push({
            id: currentNode.id,
            name: currentNode.name,
            type: currentNode.type,
            componentId: currentNode.componentId || undefined
          });
        }
      });

      return {
        nodeId,
        nodeName: node.name || 'Unnamed Node',
        images,
        vectors,
        components,
        totalElements: images.length + vectors.length + components.length
      };
    } catch (error) {
      throw new Error(`获取节点元素失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 根据Figma URL获取设计元素
   */
  async getElementsFromUrl(figmaUrl: string): Promise<NodeElements> {
    try {
      const urlInfo = this.figmaService.parseUrl(figmaUrl);
      const { fileId, nodeId } = urlInfo;

      if (!nodeId) {
        throw new Error('URL中缺少节点ID，无法提取设计元素。请确保URL包含node-id参数');
      }

      return await this.getAllNodeElements(fileId, nodeId);
    } catch (error) {
      throw new Error(`从URL获取设计元素失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 判断是否为矢量节点
   */
  private isVectorNode(node: FigmaNode): boolean {
    const vectorTypes = [
      'VECTOR',
      'ELLIPSE', 
      'POLYGON',
      'STAR',
      'LINE',
      'RECTANGLE' // 矩形也可能包含矢量信息
    ];
    
    return vectorTypes.includes(node.type) || 
           Boolean(node.fills && node.fills.some(fill => fill.type !== 'IMAGE')) ||
           Boolean(node.strokes && node.strokes.length > 0);
  }

  /**
   * 去重图片资源
   */
  private deduplicateImages(images: ImageResource[]): ImageResource[] {
    const seen = new Set<string>();
    return images.filter(image => {
      const key = image.id || image.url || image.name;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 生成设计元素摘要
   */
  generateElementsSummary(elements: NodeElements): string {
    const summary = [];
    
    summary.push(`节点名称: ${elements.nodeName}`);
    summary.push(`总元素数: ${elements.totalElements}`);
    
    if (elements.images.length > 0) {
      summary.push(`\\n📸 图片资源 (${elements.images.length}个):`);
      elements.images.forEach((img, idx) => {
        summary.push(`  ${idx + 1}. ${img.name} (${img.type})`);
      });
    }

    if (elements.vectors.length > 0) {
      summary.push(`\\n🎨 矢量元素 (${elements.vectors.length}个):`);
      elements.vectors.forEach((vec, idx) => {
        summary.push(`  ${idx + 1}. ${vec.name} (${vec.type})`);
      });
    }

    if (elements.components.length > 0) {
      summary.push(`\\n🧩 组件 (${elements.components.length}个):`);
      elements.components.forEach((comp, idx) => {
        summary.push(`  ${idx + 1}. ${comp.name} (${comp.type})`);
      });
    }

    return summary.join('\\n');
  }
}