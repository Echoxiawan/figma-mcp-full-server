# Figma MCP 工具

[English](README.md) | 简体中文

一个用于与Figma API集成的Model Context Protocol (MCP) 服务器，支持图片导出和样式数据提取。

## 功能特性

- 🖼️ **图片导出**: 根据Figma URL导出节点图片，支持PNG、JPG、SVG、PDF格式
- 🎨 **样式提取**: 获取设计元素的详细样式数据，支持CSS生成
- 📦 **批量操作**: 支持批量导出多个节点
- 🔄 **智能重试**: 内置重试机制，处理网络波动和API限制
- 🛡️ **错误处理**: 完善的错误处理和故障排除指导
- 🧩 **设计元素分析**: 深度分析设计稿中的图片、矢量、组件等元素 🆕
- 📋 **SVG提取**: 直接获取矢量图形的SVG代码 🆕

## 安装和运行方式

### 方式一：通过 npx 运行（推荐，无需安装）

```bash
npx figma-mcp-full-server figd_your_figma_token_here
```

### 方式二：全局安装后运行

```bash
# 全局安装
npm install -g figma-mcp-full-server

# 运行
figma-mcp-full-server figd_your_figma_token_here
```

### 方式三：本地项目安装

```bash
# 在项目中安装
npm install figma-mcp-full-server

# 运行
npx figma-mcp-full-server figd_your_figma_token_here
# 或者
node_modules/.bin/figma-mcp-full-server figd_your_figma_token_here
```

### 方式四：从源码运行（开发用）

```bash
git clone <repository>
cd figma-mcp
npm install
npm run build

# 运行
npm start figd_your_figma_token_here
# 或者
node build/index.js figd_your_figma_token_here
```

## 快速开始

### 1. 获取Figma访问令牌

1. 登录 [Figma](https://figma.com)
2. 进入设置页面 (Settings)
3. 找到 "Personal access tokens" 部分
4. 点击 "Create new token"
5. 复制生成的令牌（以 `figd_` 开头）

### 2. 在Claude Desktop中配置

编辑Claude配置文件（选择对应系统的路径）：

macOS/Linux: `~/.config/claude-desktop/config.json`  
Windows: `%APPDATA%\Claude Desktop\config.json`

选择以下任一配置方式：

#### 配置方式一：通过 npx 运行（推荐）

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

#### 配置方式二：全局安装后使用

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

#### 配置方式三：本地项目中使用

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

#### 配置方式四：从源码运行

```json
{
  "mcpServers": {
    "figma-mcp": {
      "command": "node",
      "args": [
        "/绝对路径/figma-mcp/build/index.js"
      ],
      "cwd": "/绝对路径/figma-mcp",
      "env": {
        "FIGMA_TOKEN": "figd_your_figma_token_here"
      }
    }
  }
}
```

⚠️ **重要提示**：
- **推荐使用方式一（npx）**：无需安装，自动使用最新版本
- **方式二（全局安装）**：适合频繁使用的情况
- **方式三（项目安装）**：适合特定项目需要特定版本的情况
- **方式四（源码运行）**：适合开发和定制化需求
- 将 `figd_your_figma_token_here` 替换为你的实际 Figma 令牌

### 3. 重启Claude Desktop

完成配置后，重启Claude Desktop使配置生效。

## 使用方法

配置完成后，你可以在Claude中直接使用：

### 获取Figma图片

```
请帮我从这个Figma URL获取图片：
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name?node-id=123-456&t=abc123-0
```

### 获取样式数据并生成CSS

```
请帮我获取这个Figma设计的样式数据，并生成CSS：
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name?node-id=123-456&t=abc123-0
```

### 获取文件信息

```
请帮我查看这个Figma文件的基本信息：
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name
```

### 获取设计元素 🆕

```
请帮我分析这个Figma节点包含哪些设计元素：
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name?node-id=123-456&t=abc123-0
```

### 获取图片资源 🆕

```
请帮我提取这个Figma节点中的所有图片资源：
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name?node-id=123-456&t=abc123-0
```

### 获取SVG数据 🆕

```
请帮我获取这个Figma节点的SVG代码：
https://www.figma.com/design/EXAMPLE_FILE_ID/Design-Name?node-id=123-456&t=abc123-0
```

## 可用工具

本MCP服务提供以下7个工具：

### 基础工具
1. **get_figma_image** - 根据Figma URL获取节点图片
2. **get_figma_styles** - 获取节点样式数据，支持CSS生成  
3. **export_multiple_images** - 批量导出多个节点图片
4. **get_file_info** - 获取Figma文件基本信息

### 设计元素工具 🆕
5. **get_node_images** - 获取节点中的所有图片资源
6. **get_node_svg** - 获取节点的SVG数据
7. **extract_node_elements** - 提取节点中的所有设计元素（图片、矢量、组件）

## 故障排除

### 常见问题

#### 1. "Cannot find module" 错误
- **原因**: 配置中使用了 `.ts` 文件而不是 `.js` 文件
- **解决**: 确保使用 `/path/to/build/index.js` 而不是 `index.ts`

#### 2. "访问被拒绝" 错误
- **原因**: Figma token无效或文件权限不足
- **解决**: 检查token是否正确，文件是否公开或有访问权限

#### 3. MCP服务无法启动
- **原因**: 路径不正确或Node.js版本过低
- **解决**: 
  - 确保使用绝对路径
  - 确保Node.js版本 ≥ 18
  - 重新构建项目：`npm run build`

#### 4. "未找到可导出的图片"
- **原因**: URL中缺少node-id参数
- **解决**: 确保URL包含 `?node-id=xxxxx-xxxxx` 参数

### 手动测试

可以手动测试服务是否正常：

```bash
cd /path/to/figma-mcp
node build/index.js figd_your_token_here
```

应该看到: `Figma MCP服务器已启动`

### 配置验证

验证JSON格式是否正确：

```bash
# macOS/Linux
cat ~/.config/claude-desktop/config.json | python -m json.tool

# Windows
type "%APPDATA%\Claude Desktop\config.json" | python -m json.tool
```

## 技术特性

### 智能重试机制
- 自动处理网络波动
- 指数退避算法
- 智能错误分类和处理

### 批量处理优化
- 自动分批处理大量节点（每批90个）
- 避免URL长度限制
- 并发控制和资源管理

### 错误处理
- 详细的错误信息和排除指导
- 友好的用户反馈
- 完整的日志记录

## 开发

### 开发模式

```bash
npm run dev
# 然后在环境变量中设置 FIGMA_TOKEN
```

### 项目结构

```
figma-mcp/
├── src/
│   ├── index.ts           # MCP服务器主文件
│   ├── figma-service.ts   # Figma API服务类
│   ├── image-extractor.ts # 图片导出功能
│   ├── style-extractor.ts # 样式提取功能
│   └── element-extractor.ts # 设计元素提取功能 🆕
├── build/                 # 编译输出
├── package.json
└── README.md
```

## 新功能详解 🆕

### 设计元素分析
- **图片资源识别**: 自动识别节点中的所有图片资源，包括嵌入图片和外部链接
- **矢量元素提取**: 提取SVG路径、形状、图标等矢量图形信息
- **组件分析**: 识别设计系统中的组件和实例
- **层次结构遍历**: 深度遍历节点树，发现嵌套的设计元素

### SVG数据获取
- **完整SVG导出**: 获取节点的完整SVG代码，包含样式和路径信息
- **矢量信息保持**: 保留原始的矢量特性，支持无损缩放
- **样式内联**: SVG包含完整的样式信息，可直接使用

### 智能元素识别
- **自动分类**: 智能识别图片、矢量、文本、组件等不同类型的元素
- **去重处理**: 自动去除重复的资源引用
- **详情控制**: 支持概览和详细信息两种输出模式

## 安全最佳实践

1. **令牌安全**: 使用环境变量存储Figma令牌，不要硬编码
2. **访问控制**: 定期轮换访问令牌
3. **权限最小化**: 只为必要的文件授予访问权限

## 许可证

MIT License

---

## 支持

如遇到问题：
1. 检查Node.js版本 ≥ 18
2. 确认Figma令牌有效
3. 验证配置文件JSON格式
4. 查看Claude Desktop日志
5. 手动测试MCP服务启动

配置成功后，即可在Claude中直接使用Figma设计文件！

### 联系方式

<img src="contact.JPG" alt="联系 Contact" width="360" />

<img src="程序员热榜.jpg" alt="程序员热榜公众号" width="360" />
