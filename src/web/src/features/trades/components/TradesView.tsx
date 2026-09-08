'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { TradeList } from './TradeList';
import { TradeCreateDialog } from './TradeCreateDialog';

/**
 * /trades — PageHeader (nút "Thêm mới") + TradeList + dialog tạo mới.
 * Nút header là CTA thêm duy nhất của trang (TradeList không còn nút/CTA
 * thêm riêng); tạo thành công → đóng + refresh list (remount TradeList qua
 * key). Route /trades/new giữ nguyên cho E2E drivers goto trực tiếp.
 */
export function TradesView() {
  const [seq, setSeq] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const openCreate = React.useCallback(() => setCreateOpen(true), []);
  const closeCreate = React.useCallback(() => setCreateOpen(false), []);

  return (
    <>
      <PageHeader
        title="Ngành nghề"
        subtitle="Danh mục ngành nghề/kỹ năng dùng khi phân công công việc — nguồn chọn cho worker, loại công việc và work order."
        actions={
          <Button onClick={openCreate}>
            Thêm mới
          </Button>
        }
      />
      <TradeList key={seq} />
      <TradeCreateDialog
        open={createOpen}
        onClose={closeCreate}
        onCreated={() => setSeq((s) => s + 1)}
      />
    </>
  );
}
