// 测试环境设置
process.env.NODE_ENV = 'test';

// 设置数据库URL为测试数据库
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:../prisma/dev.db';
}

// 设置Jest超时时间
jest.setTimeout(60000);

// 全局测试设置
beforeAll(async () => {
  console.log('🧪 开始集成测试...');
});

afterAll(async () => {
  console.log('✅ 集成测试完成');
}); 