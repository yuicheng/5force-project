# 5Force Financial Portfolio Management System

一个基于 NestJS + Prisma + TypeScript 的金融投资组合管理系统，提供完整的资产管理、持仓跟踪、交易记录和投资组合分析功能。

## 🚀 快速开始

### 环境要求
- Node.js 18+
- SQLite (默认) 或其他数据库

### 安装与运行
```bash
# 安装依赖
npm install

# 运行数据库迁移
npx prisma migrate dev

# 启动开发服务器
npm run start:dev

# 运行在端口 3003
```

### 访问地址
- **API 服务**: http://localhost:3003
- **Swagger 文档**: http://localhost:3003/api

## 📖 API 文档

### 🏠 基础接口

#### GET /
获取应用基础信息
- **描述**: 健康检查端点
- **响应**: 应用欢迎信息

---

### 📊 资产管理 (Assets)

#### POST /assets
创建单个资产
- **请求体**:
  ```json
  {
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "assetType": "stock",
    "price": 150.25
  }
  ```
- **响应**: 创建的资产信息

#### POST /assets/batch
批量创建资产
- **请求体**:
  ```json
  {
    "assets": [
      {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "assetType": "stock",
        "price": 150.25
      }
    ]
  }
  ```

#### GET /assets
获取所有资产
- **响应**: 资产列表

#### GET /assets/search?q={keyword}
搜索资产
- **查询参数**: 
  - `q`: 搜索关键词 (例: "Apple")
- **响应**: 匹配的资产列表

#### GET /assets/:id
根据ID获取资产
- **路径参数**: `id` - 资产ID
- **响应**: 资产详细信息

#### GET /assets/ticker/:ticker
根据股票代码获取资产
- **路径参数**: `ticker` - 股票代码 (例: "AAPL")
- **响应**: 资产详细信息

#### PATCH /assets/:id
更新资产信息
- **路径参数**: `id` - 资产ID
- **请求体**:
  ```json
  {
    "name": "Updated Name",
    "assetType": "stock",
    "price": 155.00
  }
  ```

#### DELETE /assets/:id
删除单个资产
- **路径参数**: `id` - 资产ID

#### DELETE /assets/batch
批量删除资产
- **请求体**:
  ```json
  {
    "ids": [1, 2, 3]
  }
  ```

#### GET /assets/:id/refresh-price
刷新资产价格
- **路径参数**: `id` - 资产ID
- **响应**: 更新后的价格信息

#### GET /assets/:id/history
获取资产历史记录 (按ID)
- **路径参数**: `id` - 资产ID
- **查询参数**:
  - `startDate`: 开始日期 (YYYY-MM-DD)
  - `endDate`: 结束日期 (YYYY-MM-DD)
  - `page`: 页码 (默认: 1)
  - `limit`: 每页数量 (默认: 30)

#### GET /assets/ticker/:ticker/history
获取资产历史记录 (按股票代码)
- **路径参数**: `ticker` - 股票代码
- **查询参数**: 同上

#### GET /assets/:id/history/latest
获取资产最新历史记录
- **路径参数**: `id` - 资产ID

#### GET /assets/ticker/:ticker/history/latest
根据股票代码获取最新历史记录
- **路径参数**: `ticker` - 股票代码

#### GET /assets/:id/history/stats
获取资产历史统计信息
- **路径参数**: `id` - 资产ID
- **查询参数**: `days` - 统计天数 (默认: 30)

---

### 💼 持仓管理 (Holdings)

#### POST /holdings
创建持仓
- **请求体**:
  ```json
  {
    "accountId": 1,
    "assetId": 1,
    "quantity": 100,
    "averageCostBasis": 140.00
  }
  ```

#### POST /holdings/batch
批量创建持仓
- **请求体**:
  ```json
  {
    "holdings": [
      {
        "accountId": 1,
        "assetId": 1,
        "quantity": 100,
        "averageCostBasis": 140.00
      }
    ]
  }
  ```

#### POST /holdings/add-to-portfolio
添加资产到投资组合 (推荐使用)
- **请求体**:
  ```json
  {
    "username": "5force",
    "ticker": "AAPL",
    "accountId": 1,
    "quantity": 100,
    "price": 150.25,
    "transactionDate": "2024-01-15",
    "updateMarketPrice": false,
    "description": "Initial purchase"
  }
  ```
- **必填字段**: username, ticker, accountId, quantity

#### GET /holdings
获取所有持仓

#### GET /holdings/account/:accountId
根据账户ID获取持仓
- **路径参数**: `accountId` - 账户ID

#### GET /holdings/user/:username
根据用户名获取持仓
- **路径参数**: `username` - 用户名

#### GET /holdings/:id
根据ID获取持仓详情
- **路径参数**: `id` - 持仓ID

#### PATCH /holdings/:id
更新持仓
- **路径参数**: `id` - 持仓ID
- **请求体**:
  ```json
  {
    "quantity": 150,
    "averageCostBasis": 145.00
  }
  ```

#### DELETE /holdings/:id
删除持仓
- **路径参数**: `id` - 持仓ID

#### DELETE /holdings/batch
批量删除持仓
- **请求体**:
  ```json
  {
    "ids": [1, 2, 3]
  }
  ```

#### POST /holdings/:id/sell
卖出持仓 (按ID)
- **路径参数**: `id` - 持仓ID
- **请求体**:
  ```json
  {
    "quantity": 50,
    "price": 155.00
  }
  ```

#### POST /holdings/sell-all-by-ticker
卖出全部持仓 (最简单方式，推荐前端使用)
- **请求体**:
  ```json
  {
    "username": "5force",
    "ticker": "AAPL"
  }
  ```
- **功能**: 自动卖出用户在该股票上的全部持仓，使用市场价格
- **必填字段**: username, ticker

#### POST /holdings/sell-by-ticker
通过股票代码卖出指定数量持仓 (高级用法)
- **请求体**:
  ```json
  {
    "username": "5force",
    "ticker": "AAPL",
    "quantity": 50,
    "price": 155.00,
    "accountId": 1
  }
  ```
- **必填字段**: username, ticker, quantity

---

### 📈 市场数据 (Market Data)

#### GET /market-data/validate/:ticker
验证股票代码是否存在
- **路径参数**: `ticker` - 股票代码
- **响应**: 
  ```json
  {
    "ticker": "AAPL",
    "isValid": true
  }
  ```

#### GET /market-data/quote/:ticker
获取单个资产实时市场数据
- **路径参数**: `ticker` - 股票代码
- **响应**: 实时价格和市场数据

#### POST /market-data/upsert-asset
更新或创建资产记录
- **请求体**:
  ```json
  {
    "ticker": "AAPL"
  }
  ```

#### POST /market-data/update-prices
批量更新资产价格
- **请求体**:
  ```json
  {
    "tickers": ["AAPL", "GOOGL", "MSFT"]
  }
  ```

#### GET /market-data/batch-quotes?tickers=AAPL,GOOGL,MSFT
批量获取资产报价
- **查询参数**: `tickers` - 逗号分隔的股票代码列表
- **响应**: 多个资产的实时数据

---

### 📊 投资组合 (Portfolio)

#### GET /portfolio/:username
获取用户完整投资组合信息
- **路径参数**: `username` - 用户名
- **响应**: 按类型分组的投资组合信息

#### GET /portfolio/:username/performance?limit=5
获取投资组合的Top涨跌幅股票
- **路径参数**: `username` - 用户名
- **查询参数**: `limit` - 返回数量限制 (默认: 5)
- **响应**: 最佳和最差表现的股票

#### GET /portfolio/:username/history?days=30
获取投资组合历史表现
- **路径参数**: `username` - 用户名
- **查询参数**: `days` - 历史天数 (默认: 30)
- **响应**: 历史表现数据和趋势

#### GET /portfolio/:username/refresh-prices
刷新投资组合中所有资产的价格
- **路径参数**: `username` - 用户名
- **响应**: 价格刷新结果

---

### 💰 交易记录 (Transactions)

#### POST /transactions
创建交易记录
- **请求体**:
  ```json
  {
    "accountId": 1,
    "transactionType": "buy",
    "transactionDate": "2024-01-15T10:00:00Z",
    "quantity": 100,
    "pricePerUnit": 150.25,
    "totalAmount": 15025,
    "description": "Bought Apple stock",
    "assetId": 1
  }
  ```

#### GET /transactions
获取所有交易记录

#### GET /transactions/account/:accountId
根据账户ID获取交易记录
- **路径参数**: `accountId` - 账户ID

#### GET /transactions/user/:username
根据用户名获取交易记录
- **路径参数**: `username` - 用户名

#### GET /transactions/:id
根据ID获取交易记录详情
- **路径参数**: `id` - 交易记录ID

#### PATCH /transactions/:id
更新交易记录
- **路径参数**: `id` - 交易记录ID
- **请求体**: 包含要更新的字段

#### DELETE /transactions/:id
删除交易记录
- **路径参数**: `id` - 交易记录ID

#### GET /transactions/cashflow/:username?days=30
获取现金流分析
- **路径参数**: `username` - 用户名
- **查询参数**: `days` - 分析天数 (默认: 30)
- **响应**: 现金流入流出分析

#### GET /transactions/cashflow/:username/by-asset-type?days=30
按资产类型分组的现金流分析
- **路径参数**: `username` - 用户名
- **查询参数**: `days` - 分析天数 (默认: 30)
- **响应**: 分组现金流分析结果

#### GET /transactions/stats/:username?days=30
获取交易统计
- **路径参数**: `username` - 用户名
- **查询参数**: `days` - 统计天数 (默认: 30)
- **响应**: 交易频率、金额等统计数据

---

## 🔧 技术栈

- **后端框架**: NestJS
- **数据库**: SQLite (Prisma ORM)
- **API 文档**: Swagger/OpenAPI
- **开发语言**: TypeScript
- **市场数据**: Finnhub API

## 📝 使用建议

### 常用工作流程

1. **添加新资产到投资组合**:
   ```bash
   POST /holdings/add-to-portfolio
   ```

2. **查看投资组合概览**:
   ```bash
   GET /portfolio/{username}
   ```

3. **卖出股票** (推荐使用简化版本):
   ```bash
   POST /holdings/sell-all-by-ticker
   ```

4. **查看交易历史**:
   ```bash
   GET /transactions/user/{username}
   ```

5. **分析投资表现**:
   ```bash
   GET /portfolio/{username}/performance
   GET /portfolio/{username}/history
   ```

### 最佳实践

- 使用 `username` 相关的 API 进行用户级别的操作
- 推荐使用基于 `ticker` 的 API 而不是基于 ID 的 API
- 定期调用 `refresh-prices` 更新市场价格
- 使用批量操作 API 提高性能

---

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License
