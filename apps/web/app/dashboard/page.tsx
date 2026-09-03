"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, isTokenExpired, clearAuth, type StoredAuth } from '@/lib/auth/storage';

function capabilityForRoles(roles: string[]): string[] {
  const caps: string[] = [];
  const lower = roles.map((r) => r.toLowerCase());
  const has = (code: string) => lower.includes(code.toLowerCase());
  if (has('ADMIN') || has('SYSTEM_ADMIN')) caps.push('Quản trị hệ thống', 'Quản lý tài khoản', 'Báo cáo tổng quan');
  if (has('PROJECT_MANAGER') || has('MANAGER')) caps.push('Quản lý dự án', 'Phê duyệt vật tư', 'Tổng hợp tiến độ');
  if (has('COORDINATOR') || has('DISPATCHER')) caps.push('Tạo / phân công Work Order', 'Quản lý lịch');
  if (has('WORKER') || has('STAFF')) caps.push('My Jobs / Today Jobs', 'Cập nhật tiến độ', 'Checklist hiện trường');
  if (has('QC') || has('QUALITY_INSPECTOR')) caps.push('Hàng đợi kiểm tra', 'Phiếu chất lượng');
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
    if (!a) { router.replace('/login'); return; }
    if (isTokenExpired(a)) { setExpired(true); return; }
    setAuth(a);
  }, [router]);

  function handleLogout() {
    clearAuth();
    router.replace('/login');
    router.refresh();
  }

  if (expired) {
    return (
      <main className="min-h-screen grid place-items-center p-4">
        <div role="alert" className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
          Phiên hết hạn, vui lòng đăng nhập lại
          <button onClick={() => { clearAuth(); router.replace('/login'); }} className="ml-3 underline">
            Về trang đăng nhập
          </button>
        </div>
      </main>
    );
  }

  if (!auth) {
    return (
      <main className="min-h-screen grid place-items-center p-4">
        <p className="text-sm text-neutral-500">Đang kiểm tra phiên đăng nhập…</p>
      </main>
    );
  }

  const caps = capabilityForRoles(auth.roles.map((r) => r.code));

  return (
    <main className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto grid gap-6">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold">Chào mừng, {auth.user.fullName}</h1>
            <p className="text-sm text-neutral-500">
              {auth.user.email} · {auth.user.status} · hết hạn {new Date(auth.expiresAt).toLocaleString()}
            </p>
          </div>
          <button onClick={handleLogout} className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100">
            Đăng xuất
          </button>
        </header>

        <section className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-medium mb-3">Phiên &amp; phạm vi (BR-13)</h2>
          <p className="text-sm">Vai trò: <strong>{auth.roles.map((r) => `${r.code} (${r.name})`).join(', ') || '—'}</strong></p>
          <p className="text-sm mt-1">
            Dự án được phép: <strong>{auth.projectIds.length ? auth.projectIds.join(', ') : '— (chưa gán dự án)'}</strong>
          </p>
          <p className="text-xs text-neutral-500 mt-3">
            Sau đăng nhập người dùng chỉ thấy chức năng thuộc quyền. Danh sách bên dưới được lọc theo roles/projectIds trả về từ API.
          </p>
        </section>

        <section className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-medium mb-3">Chức năng khả dụng</h2>
          <ul className="list-disc pl-5 grid gap-1 text-sm">
            {caps.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </section>
      </div>
    </main>
  );
}
