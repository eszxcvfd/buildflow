import { Injectable } from '@nestjs/common';
import { LoginLimiterPort } from '../../application/port/login-limiter.port';

interface Entry { count: number; windowStart: number; blockedUntil: number | null }
const MAX_FAILURES = 20;

@Injectable()
export class InMemoryLoginLimiterService implements LoginLimiterPort {
  private readonly entries = new Map<string, Entry>();

  async isBlocked(key: string): Promise<boolean> {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.blockedUntil && entry.blockedUntil > Date.now()) return true;
    if (entry.blockedUntil && entry.blockedUntil <= Date.now()) {
      this.entries.delete(key);
      return false;
    }
    return false;
  }

  async recordFailure(key: string, windowSeconds: number): Promise<void> {
    const now = Date.now();
    const entry = this.entries.get(key) ?? { count: 0, windowStart: now, blockedUntil: null };
    if (now - entry.windowStart > windowSeconds * 1000) {
      entry.count = 0;
      entry.windowStart = now;
      entry.blockedUntil = null;
    }
    entry.count += 1;
    if (entry.count >= MAX_FAILURES) {
      entry.blockedUntil = now + windowSeconds * 1000;
    }
    this.entries.set(key, entry);
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key);
  }
}
