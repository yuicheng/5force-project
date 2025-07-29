# Asset表更新优化

## 概述

为了提高系统性能并减少不必要的外部API调用，我们在Asset表中添加了`lastUpdated`字段，并实现了60分钟内不重复更新的逻辑。

## 更改内容

### 1. 数据库Schema更改

在`prisma/schema.prisma`中为Asset模型添加了`lastUpdated`字段：

```prisma
model Asset {
  // ... 其他字段
  lastUpdated          DateTime @default(now())
  // ... 其他字段
}
```

### 2. MarketDataService逻辑优化

在`src/market-data/market-data.service.ts`的`upsertAsset`方法中添加了60分钟更新检查：

```typescript
// 检查现有资产记录
const existingAsset = await this.prisma.asset.findUnique({
  where: { ticker_symbol: ticker }
});

// 如果资产存在且60分钟内已更新过，则跳过更新
if (existingAsset && existingAsset.lastUpdated) {
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (existingAsset.lastUpdated > sixtyMinutesAgo) {
    this.logger.log(`Asset ${ticker} was updated within 60 minutes, skipping update`);
    return existingAsset;
  }
}
```

## 功能特性

1. **自动时间戳**: 每次创建或更新资产时，`lastUpdated`字段会自动设置为当前时间
2. **60分钟限制**: 如果资产在60分钟内已经更新过，系统会跳过更新并返回现有数据
3. **日志记录**: 当跳过更新时，系统会记录相应的日志信息
4. **向后兼容**: 现有代码无需修改，新逻辑会自动生效

## 性能优势

- 减少不必要的外部API调用
- 降低API使用成本
- 提高响应速度
- 减少数据库写入操作

## 使用示例

```typescript
// 第一次调用 - 会更新数据
const asset1 = await marketDataService.upsertAsset('AAPL');

// 60分钟内的后续调用 - 会跳过更新
const asset2 = await marketDataService.upsertAsset('AAPL');
// 返回现有数据，不会调用外部API
```

## 迁移信息

迁移文件: `prisma/migrations/20250728164614_add_last_updated_to_asset/migration.sql`

该迁移会自动为现有记录设置`lastUpdated`字段的默认值。 