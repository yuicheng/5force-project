# 5Force Project

一个基于NestJS的投资组合管理系统，支持股票交易、持仓管理和投资组合分析。

## 功能特性

- 投资组合管理
- 实时股票价格获取
- 持仓详情
- 交易记录
- 投资组合历史记录

## 技术栈

- **后端框架**: NestJS
- **数据库**: SQLite + Prisma ORM
- **市场数据**: Finnhub API
- **测试**: Jest
- **语言**: TypeScript

## 快速开始

### 安装依赖

```bash
npm install
```

### 数据库设置

```bash
# 生成Prisma客户端
npx prisma generate

# Skip the following if you gonna use dev.db
# 运行数据库迁移 填充测试数据
npx prisma migrate dev
node scripts/seed-database.js
```

### 启动应用

```bash
# 开发模式
npm run start:dev

# 生产模式 (没有实现)
npm run start:prod
```

## 测试

### 运行测试

```bash
# 单元测试
npm test

# 集成测试
npm run test:integration
```

### 投资组合交易测试

项目包含一个完整的集成测试 `test/portfolio-trading.test.ts`，验证用户5force的投资组合交易功能：

#### 测试内容

1. **数据库备份** - 测试前自动备份数据库
2. **投资组合信息获取** - 显示用户5force的当前净值
3. **交易操作验证**:
   - 全仓卖出持有的某个股票
   - 部分卖出持有的某个股票
   - 重新建仓之前卖出的股票
4. **交易记录验证** - 确认transactions中存在相关交易
5. **投资组合平账** - 验证净值计算正确
6. **数据库恢复** - 测试后恢复原始数据

#### 运行测试

```bash
npm run test:integration
```

## API文档

启动应用后，访问 `http://localhost:3003/api` 查看Swagger API文档。

## 项目结构

```
src/
├── app.module.ts              # 主模块
├── prisma/                    # 数据库ORM
├── portfolio/                 # 投资组合
├── holdings/                  # 持仓管理
├── transactions/              # 交易记录
├── assets/                    # 资产管理
└── market-data/               # 市场数据服务
```

## 数据库模型

主要数据模型包括：

- **User** - 用户信息
- **Portfolio** - 投资组合
- **Account** - 账户信息
- **Asset** - 资产信息
- **Holding** - 持仓记录
- **Transaction** - 交易记录
- **Asset_History** - 资产价格历史
- **Portfolio_History** - 投资组合历史

## 环境变量

创建 `.env` 文件并配置以下变量：

```env
DATABASE_URL="file:./prisma/dev.db"
```

