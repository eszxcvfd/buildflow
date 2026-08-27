'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, isTokenExpired } from '@/lib/auth/storage';
import { logoutAndClear } from '@/features/auth';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import type { StoredAuth } from '@/lib/auth/storage';

function formatRoles(roles: StoredAuth['roles']) {
  if (!roles.length) return '—';
  return roles.map((r) => `${r.code} (${r.name})`).join(', ');
}

function capabilityForRoles(roles: string[]): string[] {
  // Minimal BR-13 illustration: map role codes to visible capabilities
  // Real project would derive from backend authorization; this is UI filtering.
  const caps: string[] = [];
  const lower = roles.map((r) => r.toLowerCase());
  const has = (code: string) => lower.includes(code.toLowerCase());
  // Common codes: try to be permissive – show based on whatever role is present
  if (has('ADMIN') || has('SYSTEM_ADMIN') || has('ADMINISTRATOR')) caps.push('Quản trị hệ thống', 'Quản lý tài khoản', 'Báo cáo tổng quan');
  if (has('PROJECT_MANAGER') || has('MANAGER') || has('PM')) caps.push('Quản lý dự án', 'Phê duyệt vật tư', 'Tổng hợp tiến độ');
  if (has('COORDINATOR') || has('DISPATCHER')) caps.push('Tạo / phân công Work Order', 'Quản lý lịch', 'Job Board điều phối');
  if (has('WORKER') || has('STAFF')) caps.push('My Jobs / Today Jobs', 'Cập nhật tiến độ', 'Checklist hiện trường');
  if (has('QC') || has('QUALITY_INSPECTOR') || has('INSPECTOR')) caps.push('Hàng đợi kiểm tra', 'Phiếu chất lượng', 'Yêu cầu khắc phục');
  if (has('WAREHOUSE') || has('PROCUREMENT')) caps.push('Yêu cầu vật tư — cung ứng');
  if (caps.length === 0) caps.push('Dashboard chung (quyền hạn chế theo dự án)');
  return caps;
}

export default function DashboardPage() {
  const router = useRouter();
  const [auth, setAuth] = React.useState<StoredAuth | null>(null);
  const [expired, setExpired] = React.useState(false);

  React.useEffect(() => {
    const a = getAuth();
    if (!a) {
      router.replace('/login');
      return;
    }
    if (isTokenExpired(a)) {
      setExpired(true);
      return;
    }
    setAuth(a);
  }, [router]);

  async function handleLogout() {
    try {
      await logoutAndClear();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  if (expired) {
    return (
      <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
        <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại</Alert>
        <div style={{ marginTop: '1rem' }}>
          <Button onClick={handleLogout}>Về trang đăng nhập</Button>
        </div>
      </main>
    );
  }

  if (!auth) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>Đang kiểm tra phiên đăng nhập…</p>
      </main>
    );
  }

  const caps = capabilityForRoles(auth.roles.map((r) => r.code));

  return (
    <main style={{ padding: '2rem', maxWidth: 860, margin: '0 auto', display: 'grid', gap: '1.25rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Chào mừng, {auth.user.fullName}</h1>
          <p style={{ margin: '0.4rem 0 0', color: '#6b7280' }}>
            {auth.user.email} · {auth.user.status} · expires {new Date(auth.expiresAt).toLocaleString()}
          </p>
        </div>
        <Button variant="ghost" onClick={handleLogout}>
          Đăng xuất
        </Button>
      </header>

      <Card>
        <h2 style={{ margin: '0 0 0.5rem' }}>Phiên &amp; phạm vi (BR-13)</h2>
        <p style={{ margin: 0, color: '#374151', fontSize: '0.92rem' }}>
          Vai trò: <strong>{formatRoles(auth.roles)}</strong>
        </p>
        <p style={{ margin: '0.5rem 0 0', color: '#374151', fontSize: '0.92rem' }}>
          Dự án được phép: <strong>{auth.projectIds.length ? auth.projectIds.join(', ') : '— (chưa gán dự án)'}</strong>
        </p>
        <p style={{ margin: '0.75rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
          Sau đăng nhập người dùng chỉ thấy chức năng thuộc quyền và dự án tham gia. Danh sách bên dưới được lọc
          theo roles/projectIds trả về từ <code>POST /api/v1/auth/login</code>.
        </p>
      </Card>

      <Card>
        <h2 style={{ margin: '0 0 0.75rem' }}>Chức năng khả dụng</h2>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.4rem' }}>
          {caps.map((c) => (
            <li key={c} style={{ fontSize: '0.95rem' }}>
              {c}
            </li>
          ))}
        </ul>
        {!auth.projectIds.length ? (
          <p style={{ margin: '1rem 0 0', color: '#92400e', fontSize: '0.85rem' }}>
            Chưa có dự án nào được gán — liên hệ quản lý dự án để được thêm vào dự án.
          </p>
        ) : null}
      </Card>

      <Alert tone="info">
        Thu hồi phiên (đăng xuất) là contract của IAM-SRS-002 — web đã giữ điểm tích hợp tách biệt. Token hiện lưu theo
        chính sách interim <code>localStorage buildflow.auth.v1</code> (docs/architecture/WEB.md chưa chốt provider).
      </Alert>
    </main>
  );
}
