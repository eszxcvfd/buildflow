import { Injectable } from '@nestjs/common';
import { Client } from 'pg';
import Redis from 'ioredis';
import { loadConfig } from '../config/configuration';

export type DependencyStatus = 'up' | 'down';

export interface ReadinessResult {
  status: 'ok' | 'error';
  checks: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
  };
  details?: string;
}

@Injectable()
export class HealthService {
  async checkReadiness(): Promise<ReadinessResult> {
    const config = loadConfig();
    const checks = { postgres: 'up' as DependencyStatus, redis: 'up' as DependencyStatus };
    let postgresDown = false;
    let redisDown = false;

    // Check Postgres
    if (!config.databaseUrl) {
      checks.postgres = 'down';
      postgresDown = true;
    } else {
      try {
        const client = new Client({ connectionString: config.databaseUrl, connectionTimeoutMillis: 2000 });
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
      } catch {
        checks.postgres = 'down';
        postgresDown = true;
      }
    }

    // Check Redis
    if (!config.redisUrl) {
      checks.redis = 'down';
      redisDown = true;
    } else {
      let redis: Redis | null = null;
      try {
        redis = new Redis(config.redisUrl, {
          lazyConnect: true,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
        });
        await redis.ping();
        redis.disconnect();
      } catch {
        checks.redis = 'down';
        redisDown = true;
        try {
          redis?.disconnect();
        } catch {
          // ignore
        }
      }
    }

    const allUp = checks.postgres === 'up' && checks.redis === 'up';
    let details: string | undefined;
    if (!allUp) {
      if (postgresDown && redisDown) details = 'dependencies unavailable';
      else if (postgresDown) details = 'postgres unavailable';
      else if (redisDown) details = 'redis unavailable';
    }

    return {
      status: allUp ? 'ok' : 'error',
      checks,
      ...(details ? { details } : {}),
    };
  }
}
