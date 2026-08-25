import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidCredentialsException extends HttpException {
  constructor() {
    super(
      {
        type: 'https://api.buildflow.invalid/problems/invalid-credentials',
        title: 'Invalid credentials',
        status: HttpStatus.UNAUTHORIZED,
        code: 'INVALID_CREDENTIALS',
        detail: 'Invalid email or password',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
