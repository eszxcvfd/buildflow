import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { HasherPort } from '../../application/port/hasher.port';

@Injectable()
export class BcryptHasherService implements HasherPort {
  async hash(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    // bcryptjs comparison handles $2a$ hashes; for non-bcrypt formats return false
    if (!hash || !hash.startsWith('$2')) {
      // fallback: treat hash as plain comparison for dev/test (not secure)
      // but we still try bcrypt compare; if fails return false
      try {
        return await bcrypt.compare(plain, hash);
      } catch {
        return false;
      }
    }
    return bcrypt.compare(plain, hash);
  }
}
