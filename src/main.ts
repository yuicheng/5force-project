import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用CORS
  app.enableCors({
    origin: true, // 允许所有来源（开发环境）
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'Accept', 
      'Origin', 
      'X-Requested-With',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods'
    ],
    credentials: true,
    optionsSuccessStatus: 200, // 对于旧版本浏览器的支持
  });

  const port = process.env.PORT ?? 3003;

  // 配置Swagger文档
  const config = new DocumentBuilder()
    .setTitle('Financial Portfolio API')
    .setDescription('Financial Portfolio管理系统的后端API文档')
    .setVersion('1.0')
    .addServer(`http://localhost:${port}`, 'Development server')
    .addTag('market-data', '市场数据相关接口')
    .addTag('portfolio', '投资组合相关接口')
    .addTag('assets', '资产管理相关接口')
    .addTag('transactions', '交易记录相关接口')
    .addTag('holdings', '持仓管理相关接口')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation is available at: http://localhost:${port}/api`);
}
bootstrap();
