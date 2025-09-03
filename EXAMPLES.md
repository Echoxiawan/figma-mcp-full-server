# 使用示例

本文档展示如何使用 Figma MCP Server 的各种运行方式。

## 1. 快速测试（使用 npx）

最快的测试方式，无需安装：

```bash
# 使用 npx 直接运行（推荐）
npx figma-mcp-full-server figd_your_figma_token_here

# 或者先下载再运行
npx figma-mcp-full-server@latest figd_your_figma_token_here
```

## 2. 全局安装使用

适合频繁使用：

```bash
# 安装
npm install -g figma-mcp-full-server

# 使用
figma-mcp-full-server figd_your_figma_token_here

# 更新到最新版本
npm update -g figma-mcp-full-server
```

## 3. 项目本地使用

适合特定项目：

```bash
# 在项目目录中安装
npm install figma-mcp-full-server

# 使用
npx figma-mcp-full-server figd_your_figma_token_here

# 或者直接调用
./node_modules/.bin/figma-mcp-full-server figd_your_figma_token_here
```

## 4. 开发环境使用

从源码构建和运行：

```bash
# 克隆仓库
git clone https://github.com/yourusername/figma-mcp-full-server.git
cd figma-mcp-full-server

# 安装依赖
npm install

# 开发模式运行（使用 tsx）
npm run dev

# 构建并运行
npm run build
npm start figd_your_figma_token_here

# 或者直接运行编译后的文件
node build/index.js figd_your_figma_token_here
```

## Claude Desktop 配置示例

### 配置示例 1：使用 npx（推荐）

**优点**：无需安装，总是使用最新版本

```json
{
  "mcpServers": {
    "figma-mcp-full-server": {
      "command": "npx",
      "args": ["figma-mcp-full-server"],
      "env": {
        "FIGMA_TOKEN": "figd_your_actual_token_here"
      }
    }
  }
}
```

### 配置示例 2：全局安装

**优点**：启动速度快，版本稳定

```bash
npm install -g figma-mcp-full-server
```

```json
{
  "mcpServers": {
    "figma-mcp-full-server": {
      "command": "figma-mcp-full-server",
      "env": {
        "FIGMA_TOKEN": "figd_your_actual_token_here"
      }
    }
  }
}
```

### 配置示例 3：本地项目

**优点**：项目隔离，版本控制

```json
{
  "mcpServers": {
    "figma-mcp-full-server": {
      "command": "npx",
      "args": ["figma-mcp-full-server"],
      "cwd": "/path/to/your/project",
      "env": {
        "FIGMA_TOKEN": "figd_your_actual_token_here"
      }
    }
  }
}
```

### 配置示例 4：开发版本

**优点**：可定制，最新代码

```json
{
  "mcpServers": {
    "figma-mcp-full-server": {
      "command": "node",
      "args": ["/absolute/path/to/figma-mcp-full-server/build/index.js"],
      "cwd": "/absolute/path/to/figma-mcp-full-server",
      "env": {
        "FIGMA_TOKEN": "figd_your_actual_token_here"
      }
    }
  }
}
```

## 环境变量使用

除了在配置文件中设置令牌，也可以使用系统环境变量：

### macOS/Linux
```bash
# 临时设置
export FIGMA_TOKEN="figd_your_actual_token_here"
npx figma-mcp-full-server

# 永久设置（添加到 ~/.bashrc 或 ~/.zshrc）
echo 'export FIGMA_TOKEN="figd_your_actual_token_here"' >> ~/.bashrc
```

### Windows
```cmd
# 临时设置
set FIGMA_TOKEN=figd_your_actual_token_here
npx figma-mcp-full-server

# 永久设置
setx FIGMA_TOKEN "figd_your_actual_token_here"
```

### PowerShell
```powershell
# 临时设置
$env:FIGMA_TOKEN="figd_your_actual_token_here"
npx figma-mcp-full-server

# 永久设置（用户级）
[Environment]::SetEnvironmentVariable("FIGMA_TOKEN", "figd_your_actual_token_here", "User")
```

## 故障排除

### 常见问题

1. **"Cannot find module 'figma-mcp-full-server'"**
   - 解决方案：使用 `npx figma-mcp-full-server` 或先安装 `npm install -g figma-mcp-full-server`

2. **"访问被拒绝"错误**
   - 检查 Figma token 是否正确
   - 确认对目标文件有访问权限

3. **"Command not found: figma-mcp-full-server"**
   - 全局安装：`npm install -g figma-mcp-full-server`
   - 或使用 npx：`npx figma-mcp-full-server`

4. **Claude Desktop 无法连接**
   - 检查配置文件路径是否正确
   - 重启 Claude Desktop
   - 查看 Claude Desktop 日志文件

### 调试模式

查看详细错误信息：

```bash
# 设置调试模式
DEBUG=* npx figma-mcp-full-server figd_your_token_here

# 或者查看 Node.js 详细信息
NODE_DEBUG=* npx figma-mcp-full-server figd_your_token_here
```

## 性能优化

### 缓存优化
- npx 会缓存下载的包，第二次运行会更快
- 全局安装适合频繁使用的场景
- 项目本地安装适合特定版本需求

### 网络优化
```bash
# 使用国内 npm 镜像（如果网络慢）
npm config set registry https://registry.npmmirror.com
npx figma-mcp-full-server figd_your_token_here

# 恢复官方镜像
npm config set registry https://registry.npmjs.org
```
