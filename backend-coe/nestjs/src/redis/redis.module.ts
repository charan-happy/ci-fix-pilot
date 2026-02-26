import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisHealthIndicator } from '@redis/redis.health';
import { REDIS_CLIENT, RedisProvider } from '@redis/redis.provider';
import { Redis } from 'ioredis';

@Module({
  imports: [ConfigModule],
  providers: [
    RedisProvider,
    {
      provide: RedisHealthIndicator,
      useFactory: (redisClient: Redis) => new RedisHealthIndicator(redisClient),
      inject: [REDIS_CLIENT],
    },
  ],
  exports: [RedisProvider, RedisHealthIndicator],
})
export class RedisModule {}
