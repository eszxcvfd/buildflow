import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  traceId: string;
  errors?: Record<string, string[]>;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId =
      (request.headers['x-request-id'] as string) ??
      (request.headers['x-trace-id'] as string) ??
      randomUUID();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const excResponse = exception.getResponse() as unknown;

      // Handle class-validator BadRequest with array messages
      if (status === HttpStatus.BAD_REQUEST && typeof excResponse === 'object' && excResponse !== null) {
        const body = excResponse as Record<string, unknown>;
        // Nest ValidationPipe returns { message: string[], error: string, statusCode: number }
        if (Array.isArray(body['message'])) {
          const messages = body['message'] as string[];
          const errors: Record<string, string[]> = {};
          for (const msg of messages) {
            // naive: put under 'body' or parse field
            // class-validator typically returns "email must be an email"
            errors['body'] = errors['body'] ?? [];
            errors['body'].push(msg);
          }
          const problem: ProblemDetails = {
            type: 'https://api.buildflow.invalid/problems/validation-error',
            title: 'Validation failed',
            status,
            code: 'VALIDATION_ERROR',
            detail: 'Request contains invalid fields',
            traceId,
            errors,
          };
          response.status(status).json(problem);
          return;
        }
      }

      // If exception response already looks like ProblemDetails (from our guards/use-cases), passthrough
      if (
        typeof excResponse === 'object' &&
        excResponse !== null &&
        'code' in excResponse &&
        'title' in excResponse
      ) {
        const p = excResponse as Partial<ProblemDetails> & { status?: number; statusCode?: number };
        const problem: ProblemDetails = {
          type: (p.type as string) ?? 'https://api.buildflow.invalid/problems/error',
          title: (p.title as string) ?? exception.message,
          status: (p.status as number) ?? status,
          code: (p.code as string) ?? 'ERROR',
          detail: (p.detail as string) ?? exception.message,
          traceId,
          ...(p.errors ? { errors: p.errors as Record<string, string[]> } : {}),
        };
        response.status(status).json(problem);
        return;
      }

      // Generic HttpException to ProblemDetails
      const title = this.titleForStatus(status);
      const code = this.codeForStatus(status);
      const detail = exception.message || title;
      const problem: ProblemDetails = {
        type: `https://api.buildflow.invalid/problems/${code.toLowerCase().replace(/_/g, '-')}`,
        title,
        status,
        code,
        detail,
        traceId,
      };
      response.status(status).json(problem);
      return;
    }

    // Unknown error -> 500
    const problem: ProblemDetails = {
      type: 'https://api.buildflow.invalid/problems/internal-error',
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred',
      traceId,
    };
    response.status(500).json(problem);
  }

  private titleForStatus(status: number): string {
    switch (status) {
      case 400:
        return 'Bad Request';
      case 401:
        return 'Unauthorized';
      case 403:
        return 'Forbidden';
      case 404:
        return 'Not Found';
      case 409:
        return 'Conflict';
      case 422:
        return 'Unprocessable Entity';
      default:
        return 'Error';
    }
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'UNPROCESSABLE_ENTITY';
      default:
        return 'ERROR';
    }
  }
}
