import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { SESSION_REPOSITORY, SessionRepositoryPort } from '../../domain/repository/session-repository.port';
import { InvalidCredentialsException } from '../exception/invalid-credentials.exception';

export interface LoginCommand {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const email = command.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    // Generic error for both not found and wrong password, also for locked/disabled
    if (!user) {
      throw new InvalidCredentialsException();
    }

    if (user.status === 'LOCKED' || user.status === 'DISABLED') {
      throw new InvalidCredentialsException();
    }

    const passwordMatches = await bcrypt.compare(command.password, user.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsException();
    }

    // 256-bit random token (32 bytes), encoded as hex (64 chars)
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Optional expiry: 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.sessions.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return {
      token: rawToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }
}
