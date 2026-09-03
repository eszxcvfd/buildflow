import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { HasherPort } from '../../application/port/hasher.port';

@Injectable()
export class BcryptHasherService implements HasherPort {
  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
