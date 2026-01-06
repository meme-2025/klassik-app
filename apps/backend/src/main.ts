import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGIN') || '*',
    credentials: true,
  });

  // Set global prefix
  app.setGlobalPrefix('api');

  const port = configService.get('BACKEND_PORT') || 3001;
  await app.listen(port);

  console.log('🚀 Klassik Gaming Backend Started!');
  console.log(`📡 API running on: http://localhost:${port}/api`);
  console.log(`🔌 WebSocket available on: ws://localhost:${port}`);
  console.log(`⛏️  Kaspa Network: ${configService.get('KASPA_NETWORK')}`);
  console.log(`💰 Casino Address: ${configService.get('CASINO_KASPA_ADDRESS')}`);
}

bootstrap();
