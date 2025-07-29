# Financial Portfolio API Documentation

这是一个Financial Portfolio应用的后端API，提供投资组合管理、资产跟踪、交易记录和性能分析功能。

## 模块概览

### 1. Market Data Module (`/market-data`)
处理Yahoo Finance API集成，提供实时价格数据和资产验证。

### 2. Portfolio Module (`/portfolio`)
投资组合浏览和性能分析。

### 3. Assets Module (`/assets`)
资产管理，支持CRUD操作和批量操作。

### 4. Transactions Module (`/transactions`)
交易记录管理和现金流分析。

### 5. Holdings Module (`/holdings`)
持仓管理，支持添加/删除资产到投资组合。

## API 端点

### Market Data API

#### 验证Ticker
```http
GET /market-data/validate/{ticker}
```
验证ticker是否存在于真实世界中。

**响应示例：**
```json
{
  "ticker": "AAPL",
  "isValid": true
}
```

#### 获取单个资产报价
```http
GET /market-data/quote/{ticker}
```
获取资产的实时市场数据。

**响应示例：**
```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "currentPrice": 150.25,
  "percentChange": 2.5,
  "currency": "USD"
}
```

#### 更新或创建资产
```http
POST /market-data/upsert-asset
Content-Type: application/json

{
  "ticker": "AAPL"
}
```

#### 批量更新价格
```http
POST /market-data/update-prices
Content-Type: application/json

{
  "tickers": ["AAPL", "GOOGL", "MSFT"]
}
```

#### 批量获取报价
```http
GET /market-data/batch-quotes?tickers=AAPL,GOOGL,MSFT
```

### Portfolio API

#### 获取投资组合
```http
GET /portfolio/{username}
```
获取用户的完整投资组合信息，按类型分组。

**响应示例：**
```json
{
  "id": 1,
  "name": "My Portfolio",
  "currency": "USD",
  "totalValue": 50000,
  "cashValue": 10000,
  "investmentValue": 40000,
  "accounts": [
    {
      "id": 1,
      "institutionName": "Fidelity",
      "accountName": "401k",
      "accountType": "investment",
      "balanceCurrent": 40000,
      "holdings": [
        {
          "id": 1,
          "ticker": "AAPL",
          "name": "Apple Inc.",
          "assetType": "stock",
          "quantity": 100,
          "averageCostBasis": 140.00,
          "currentPrice": 150.25,
          "marketValue": 15025,
          "unrealizedGainLoss": 1025,
          "percentChange": 2.5
        }
      ]
    }
  ]
}
```

#### 获取性能数据
```http
GET /portfolio/{username}/performance?limit=5
```
获取Top 5涨跌幅股票。

#### 获取历史表现
```http
GET /portfolio/{username}/history?days=30
```
获取投资组合历史表现数据。

#### 刷新价格
```http
GET /portfolio/{username}/refresh-prices
```
刷新投资组合中所有资产的价格。

### Assets API

#### 创建资产
```http
POST /assets
Content-Type: application/json

{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "assetType": "stock",
  "price": 150.25
}
```

#### 批量创建资产
```http
POST /assets/batch
Content-Type: application/json

{
  "assets": [
    {
      "ticker": "AAPL",
      "name": "Apple Inc."
    },
    {
      "ticker": "GOOGL",
      "name": "Alphabet Inc."
    }
  ]
}
```

#### 获取所有资产
```http
GET /assets
```

#### 搜索资产
```http
GET /assets/search?q=Apple
```

#### 获取单个资产
```http
GET /assets/{id}
```

#### 根据Ticker获取资产
```http
GET /assets/ticker/{ticker}
```

#### 更新资产
```http
PATCH /assets/{id}
Content-Type: application/json

{
  "name": "Updated Name",
  "price": 155.00
}
```

#### 删除资产
```http
DELETE /assets/{id}
```

#### 批量删除资产
```http
DELETE /assets/batch
Content-Type: application/json

{
  "ids": [1, 2, 3]
}
```

#### 刷新资产价格
```http
GET /assets/{id}/refresh-price
```

### Transactions API

#### 创建交易记录
```http
POST /transactions
Content-Type: application/json

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

#### 获取所有交易
```http
GET /transactions
```

#### 根据账户获取交易
```http
GET /transactions/account/{accountId}
```

#### 根据用户获取交易
```http
GET /transactions/user/{username}
```

#### 获取现金流分析
```http
GET /transactions/cashflow/{username}?days=30
```

#### 按资产类型分组的现金流
```http
GET /transactions/cashflow/{username}/by-asset-type?days=30
```

#### 获取交易统计
```http
GET /transactions/stats/{username}?days=30
```

### Holdings API

#### 创建持仓
```http
POST /holdings
Content-Type: application/json

{
  "accountId": 1,
  "assetId": 1,
  "quantity": 100,
  "averageCostBasis": 140.00
}
```

#### 批量创建持仓
```http
POST /holdings/batch
Content-Type: application/json

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

#### 添加资产到投资组合（On Demand Populate）
```http
POST /holdings/add-to-portfolio
Content-Type: application/json

{
  "username": "john_doe",
  "ticker": "AAPL",
  "accountId": 1,
  "quantity": 100,
  "price": 150.25
}
```

#### 获取所有持仓
```http
GET /holdings
```

#### 根据账户获取持仓
```http
GET /holdings/account/{accountId}
```

#### 根据用户获取持仓
```http
GET /holdings/user/{username}
```

#### 更新持仓
```http
PATCH /holdings/{id}
Content-Type: application/json

{
  "quantity": 150,
  "averageCostBasis": 145.00
}
```

#### 删除持仓
```http
DELETE /holdings/{id}
```

#### 批量删除持仓
```http
DELETE /holdings/batch
Content-Type: application/json

{
  "ids": [1, 2, 3]
}
```

#### 卖出持仓
```http
POST /holdings/{id}/sell
Content-Type: application/json

{
  "quantity": 50,
  "price": 155.00
}
```

## 使用示例

### 1. 浏览投资组合
```bash
# 获取用户投资组合
curl -X GET "http://localhost:3000/portfolio/john_doe"

# 获取性能数据
curl -X GET "http://localhost:3000/portfolio/john_doe/performance?limit=5"

# 获取现金流分析
curl -X GET "http://localhost:3000/transactions/cashflow/john_doe?days=30"
```

### 2. 添加资产到投资组合
```bash
# 添加股票到投资组合（自动验证ticker并获取价格）
curl -X POST "http://localhost:3000/holdings/add-to-portfolio" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "ticker": "AAPL",
    "accountId": 1,
    "quantity": 100
  }'
```

### 3. 批量操作
```bash
# 批量创建资产
curl -X POST "http://localhost:3000/assets/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "assets": [
      {"ticker": "AAPL", "name": "Apple Inc."},
      {"ticker": "GOOGL", "name": "Alphabet Inc."}
    ]
  }'

# 批量删除持仓
curl -X DELETE "http://localhost:3000/holdings/batch" \
  -H "Content-Type: application/json" \
  -d '{"ids": [1, 2, 3]}'
```

### 4. 实时价格更新
```bash
# 刷新投资组合价格
curl -X GET "http://localhost:3000/portfolio/john_doe/refresh-prices"

# 获取实时报价
curl -X GET "http://localhost:3000/market-data/batch-quotes?tickers=AAPL,GOOGL,MSFT"
```

## 特性

1. **实时价格更新**: 集成Yahoo Finance API获取最新价格
2. **On Demand Populate**: 添加资产时自动验证ticker并获取市场数据
3. **批量操作**: 支持批量创建、更新、删除操作
4. **性能分析**: Top 5涨跌幅、现金流分析、历史表现
5. **分组显示**: 按账户类型和资产类型分组显示
6. **交易记录**: 完整的买卖交易记录和现金流追踪

## 启动应用

```bash
# 安装依赖
npm install

# 运行数据库迁移
npx prisma migrate dev

# 启动开发服务器
npm run start:dev
```

应用将在 `http://localhost:3000` 启动。 