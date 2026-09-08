import { PublishCheckUnmet } from '../../../../domain/service/work-order-publish-check.policy';
import { CheckWorkOrderPublishOutput } from '../../../../application/use-case/check-work-order-publish.use-case';

export interface PublishCheckUnmetDto {
  code: string;
  field: string;
  message: string;
}

export interface PublishCheckResponseDto {
  workOrderId: string;
  status: string;
  ready: boolean;
  unmet: PublishCheckUnmetDto[];
  checkedAt: string;
}

/** JOB-SRS-002 (issue #42) — response kiểm tra điều kiện công bố. */
export function toPublishCheckResponse(output: CheckWorkOrderPublishOutput): PublishCheckResponseDto {
  return {
    workOrderId: output.workOrderId,
    status: output.status,
    ready: output.ready,
    unmet: output.unmet.map(
      (u: PublishCheckUnmet): PublishCheckUnmetDto => ({ code: u.code, field: u.field, message: u.message }),
    ),
    checkedAt: output.checkedAt.toISOString(),
  };
}
