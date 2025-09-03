import { FigmaService, FigmaNode } from './figma-service.js';

export interface StyleData {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fills?: Array<{
    type: string;
    color?: {
      r: number;
      g: number;
      b: number;
      a: number;
    };
    gradientStops?: Array<{
      color: { r: number; g: number; b: number; a: number };
      position: number;
    }>;
  }>;
  strokes?: Array<{
    type: string;
    color?: {
      r: number;
      g: number;
      b: number;
      a: number;
    };
  }>;
  strokeWeight?: number;
  cornerRadius?: number;
  effects?: Array<{
    type: string;
    visible: boolean;
    radius?: number;
    color?: {
      r: number;
      g: number;
      b: number;
      a: number;
    };
    offset?: {
      x: number;
      y: number;
    };
  }>;
  textStyle?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    letterSpacing?: number;
    lineHeight?: number;
    textAlign?: string;
    textColor?: {
      r: number;
      g: number;
      b: number;
      a: number;
    };
  };
  constraints?: {
    vertical: string;
    horizontal: string;
  };
}

export interface ComponentStyles {
  fileInfo: {
    fileId: string;
    fileName: string;
    lastModified: string;
  };
  styles: StyleData[];
  globalStyles?: Record<string, any>;
}

export class FigmaStyleExtractor {
  constructor(private figmaService: FigmaService) {}

  /**
   * 根据Figma URL获取样式数据
   */
  async getStylesFromUrl(figmaUrl: string): Promise<ComponentStyles> {
    try {
      const urlInfo = this.figmaService.parseUrl(figmaUrl);
      const { fileId, nodeId } = urlInfo;

      const file = await this.figmaService.getFile(fileId);
      
      let targetNodes: FigmaNode[] = [];

      if (nodeId) {
        // 获取特定节点
        const node = await this.figmaService.getNode(fileId, nodeId);
        if (node) {
          targetNodes = [node];
        }
      } else {
        // 获取整个文件的主要组件
        targetNodes = this.extractMainComponents(file.document);
      }

      const styles = targetNodes.map(node => this.extractNodeStyle(node));

      return {
        fileInfo: {
          fileId,
          fileName: file.name,
          lastModified: file.lastModified,
        },
        styles,
        globalStyles: file.styles,
      };
    } catch (error) {
      throw new Error(`获取样式数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 提取节点样式
   */
  private extractNodeStyle(node: FigmaNode): StyleData {
    const style: StyleData = {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
    };

    // 位置和尺寸
    if (node.absoluteBoundingBox) {
      style.position = {
        x: node.absoluteBoundingBox.x,
        y: node.absoluteBoundingBox.y,
        width: node.absoluteBoundingBox.width,
        height: node.absoluteBoundingBox.height,
      };
    }

    // 填充样式
    if (node.fills && node.fills.length > 0) {
      style.fills = node.fills.map(fill => ({
        type: fill.type,
        color: fill.color ? {
          r: Math.round(fill.color.r * 255),
          g: Math.round(fill.color.g * 255),
          b: Math.round(fill.color.b * 255),
          a: fill.color.a || 1,
        } : undefined,
        gradientStops: fill.gradientStops?.map((stop: any) => ({
          color: {
            r: Math.round(stop.color.r * 255),
            g: Math.round(stop.color.g * 255),
            b: Math.round(stop.color.b * 255),
            a: stop.color.a || 1,
          },
          position: stop.position,
        })),
      }));
    }

    // 描边样式
    if (node.strokes && node.strokes.length > 0) {
      style.strokes = node.strokes.map(stroke => ({
        type: stroke.type,
        color: stroke.color ? {
          r: Math.round(stroke.color.r * 255),
          g: Math.round(stroke.color.g * 255),
          b: Math.round(stroke.color.b * 255),
          a: stroke.color.a || 1,
        } : undefined,
      }));
    }

    // 描边粗细
    if (node.strokeWeight !== undefined) {
      style.strokeWeight = node.strokeWeight;
    }

    // 圆角
    if (node.cornerRadius !== undefined) {
      style.cornerRadius = node.cornerRadius;
    }

    // 效果（阴影、模糊等）
    if (node.effects && node.effects.length > 0) {
      style.effects = node.effects.map(effect => ({
        type: effect.type,
        visible: effect.visible !== false,
        radius: effect.radius,
        color: effect.color ? {
          r: Math.round(effect.color.r * 255),
          g: Math.round(effect.color.g * 255),
          b: Math.round(effect.color.b * 255),
          a: effect.color.a || 1,
        } : undefined,
        offset: effect.offset ? {
          x: effect.offset.x,
          y: effect.offset.y,
        } : undefined,
      }));
    }

    // 文本样式
    if (node.style) {
      style.textStyle = {
        fontFamily: node.style.fontFamily,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        letterSpacing: node.style.letterSpacing,
        lineHeight: node.style.lineHeightPx,
        textAlign: node.style.textAlignHorizontal,
      };

      // 如果有文本颜色信息
      if (node.fills && node.fills.length > 0 && node.type === 'TEXT') {
        const textFill = node.fills[0];
        if (textFill.color) {
          style.textStyle.textColor = {
            r: Math.round(textFill.color.r * 255),
            g: Math.round(textFill.color.g * 255),
            b: Math.round(textFill.color.b * 255),
            a: textFill.color.a || 1,
          };
        }
      }
    }

    // 约束
    if (node.constraints) {
      style.constraints = {
        vertical: node.constraints.vertical,
        horizontal: node.constraints.horizontal,
      };
    }

    return style;
  }

  /**
   * 提取文件中的主要组件
   */
  private extractMainComponents(document: FigmaNode): FigmaNode[] {
    const components: FigmaNode[] = [];

    const traverse = (node: FigmaNode) => {
      // 收集有意义的节点（非容器节点或有样式的节点）
      if (this.isStyledNode(node)) {
        components.push(node);
      }

      // 递归遍历子节点
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    if (document.children) {
      document.children.forEach(traverse);
    }

    return components;
  }

  /**
   * 判断节点是否有样式信息
   */
  private isStyledNode(node: FigmaNode): boolean {
    return !!(
      node.fills?.length ||
      node.strokes?.length ||
      node.effects?.length ||
      node.cornerRadius !== undefined ||
      node.style ||
      ['RECTANGLE', 'ELLIPSE', 'POLYGON', 'TEXT', 'COMPONENT', 'INSTANCE'].includes(node.type)
    );
  }

  /**
   * 获取指定节点的CSS样式字符串
   */
  generateCSS(styleData: StyleData): string {
    const cssRules: string[] = [];

    // 位置和尺寸
    if (styleData.position) {
      cssRules.push(`width: ${styleData.position.width}px`);
      cssRules.push(`height: ${styleData.position.height}px`);
    }

    // 背景色
    if (styleData.fills && styleData.fills.length > 0) {
      const fill = styleData.fills[0];
      if (fill.color) {
        const { r, g, b, a } = fill.color;
        if (a === 1) {
          cssRules.push(`background-color: rgb(${r}, ${g}, ${b})`);
        } else {
          cssRules.push(`background-color: rgba(${r}, ${g}, ${b}, ${a})`);
        }
      }
    }

    // 边框
    if (styleData.strokes && styleData.strokes.length > 0) {
      const stroke = styleData.strokes[0];
      const weight = styleData.strokeWeight || 1;
      if (stroke.color) {
        const { r, g, b, a } = stroke.color;
        if (a === 1) {
          cssRules.push(`border: ${weight}px solid rgb(${r}, ${g}, ${b})`);
        } else {
          cssRules.push(`border: ${weight}px solid rgba(${r}, ${g}, ${b}, ${a})`);
        }
      }
    }

    // 圆角
    if (styleData.cornerRadius !== undefined) {
      cssRules.push(`border-radius: ${styleData.cornerRadius}px`);
    }

    // 文本样式
    if (styleData.textStyle) {
      const textStyle = styleData.textStyle;
      if (textStyle.fontFamily) {
        cssRules.push(`font-family: "${textStyle.fontFamily}"`);
      }
      if (textStyle.fontSize) {
        cssRules.push(`font-size: ${textStyle.fontSize}px`);
      }
      if (textStyle.fontWeight) {
        cssRules.push(`font-weight: ${textStyle.fontWeight}`);
      }
      if (textStyle.letterSpacing) {
        cssRules.push(`letter-spacing: ${textStyle.letterSpacing}px`);
      }
      if (textStyle.lineHeight) {
        cssRules.push(`line-height: ${textStyle.lineHeight}px`);
      }
      if (textStyle.textAlign) {
        cssRules.push(`text-align: ${textStyle.textAlign.toLowerCase()}`);
      }
      if (textStyle.textColor) {
        const { r, g, b, a } = textStyle.textColor;
        if (a === 1) {
          cssRules.push(`color: rgb(${r}, ${g}, ${b})`);
        } else {
          cssRules.push(`color: rgba(${r}, ${g}, ${b}, ${a})`);
        }
      }
    }

    // 阴影效果
    if (styleData.effects && styleData.effects.length > 0) {
      const shadows = styleData.effects
        .filter(effect => effect.type === 'DROP_SHADOW' && effect.visible)
        .map(effect => {
          const x = effect.offset?.x || 0;
          const y = effect.offset?.y || 0;
          const blur = effect.radius || 0;
          if (effect.color) {
            const { r, g, b, a } = effect.color;
            return `${x}px ${y}px ${blur}px rgba(${r}, ${g}, ${b}, ${a})`;
          }
          return '';
        })
        .filter(shadow => shadow);

      if (shadows.length > 0) {
        cssRules.push(`box-shadow: ${shadows.join(', ')}`);
      }
    }

    return cssRules.length > 0 ? cssRules.join(';\n  ') + ';' : '';
  }
}