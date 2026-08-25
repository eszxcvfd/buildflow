import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { SESSION_REPOSITORY, SessionRepositoryPort } from '../../domain/repository/session-repository.port';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
  ) {}

  async execute(rawToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.sessions.deleteByTokenHash(tokenHash);
  }
}
