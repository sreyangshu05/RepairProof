import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisThrottlerStorage } from './redis-throttler-storage';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RedisThrottlerStorage,
      useFactory: (config: ConfigService) =>
        new RedisThrottlerStorage(config.get<string>('REDIS_URL')),
      inject: [ConfigService],
    },
  ],
  exports: [RedisThrottlerStorage],
})
export class RateLimitModule {}
