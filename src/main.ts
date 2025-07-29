import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用CORS
  app.enableCors({
    origin: [
      /^http:\/\/localhost(:\d+)?$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // 配置Swagger文档
  const config = new DocumentBuilder()
    .setTitle('Financial Portfolio API')
    .setDescription('Financial Portfolio管理系统的后端API文档')
    .setVersion('1.0')
    .addTag('market-data', '市场数据相关接口')
    .addTag('portfolio', '投资组合相关接口')
    .addTag('assets', '资产管理相关接口')
    .addTag('transactions', '交易记录相关接口')
    .addTag('holdings', '持仓管理相关接口')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
  
  console.log(`🚀 Application is running on: http://localhost:${process.env.PORT ?? 3003}`);
  console.log(`📚 Swagger documentation is available at: http://localhost:${process.env.PORT ?? 3003}/api`);
}
bootstrap();
