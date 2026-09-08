import { PublishCheckSnapshot } from '../service/work-order-publish-check.policy';

/**
 * JOB-SRS-002 (issue #42) — read-port RIÊNG cho publish-check (không đụng
 * `work-order-repository.port.ts` thuộc slice #41/#43). Đọc batch 1 query
 * (WO row raw + project status + work-type row + area row + trade rows),
 * không N+1, không mutate.
 */
export interface WorkOrderPublishCheckReadPort {
  /** Null khi Work Order không tồn tại (caller phân biệt 403/404). */
  fetchSnapshot(workOrderId: string): Promise<PublishCheckSnapshot | null>;
}

export const JOB_PUBLISH_CHECK_READ_PORT = Symbol('JOB_PUBLISH_CHECK_READ_PORT');
