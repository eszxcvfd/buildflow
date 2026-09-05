'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { logoutAndClear } from '@/features/auth';
import { BrandMark } from './BrandMark';
import { AUTH_CHANGED_EVENT, getAuth, isTokenExpired, type StoredAuth } from '@/lib/auth/storage';

interface NavItem {
  href: string;
  label: string;
  /** mã role được phép thấy; undefined = mọi người đã đăng nhập */
  adminOnly?: boolean;
}

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Điều hành',
    items: [
      { href: '/dashboard', label: 'Tổng quan' },
      { href: '/projects', label: 'Dự án' },
    ],
  },
  {
    title: 'Đối tác thi công',
    items: [{ href: '/contractors', label: 'Nhà thầu' }],
  },
  {
    title: 'Nguồn lực',
    items: [
      { href: '/workers', label: 'Công nhân', adminOnly: true },
      { href: '/trades', label: 'Ngành nghề', adminOnly: true },
    ],
  },
  {
    title: 'Quản trị',
    items: [
      { href: '/admin/users', label: 'Tài khoản', adminOnly: true },
      { href: '/admin/audit-logs', label: 'Nhật ký thao tác', adminOnly: true },
    ],
  },
];

const TITLES: Array<[prefix: string, title: string]> = [
  ['/dashboard', 'Tổng quan'],
  ['/projects', 'Dự án'],
  ['/contractors', 'Nhà thầu'],
  ['/workers', 'Công nhân'],
  ['/trades', 'Ngành nghề'],
  ['/admin/users', 'Tài khoản'],
  ['/admin/audit-logs', 'Nhật ký thao tác'],
  ['/profile', 'Hồ sơ cá nhân'],
];

const ADMIN_CODES = new Set(['ADMIN', 'SYSTEM_ADMIN', 'ADMINISTRATOR']);

function pageTitle(pathname: string): string {
  const hit = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? hit[1] : 'Buildflow';
}

function isAdmin(roles: Array<{ code: string }>): boolean {
  return roles.some((r) => ADMIN_CODES.has(r.code.toUpperCase()));
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [auth, setAuth] = React.useState<StoredAuth | null>(null);
  const [checked, setChecked] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const a = getAuth();
    if (!a || isTokenExpired(a)) {
      router.replace('/login?reason=session-expired');
      return;
    }
    setAuth(a);
    setChecked(true);
  }, [router]);

  // đóng drawer khi điều hướng (mobile)
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // đồng bộ lại thông tin user trên navbar khi session thay đổi (vd: lưu hồ sơ cá nhân)
  React.useEffect(() => {
    function syncAuth() {
      const a = getAuth();
      if (a) setAuth(a);
    }
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth);
  }, []);

  if (!checked || !auth) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--bf-muted)' }}>
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  const admin = isAdmin(auth.roles);

  async function handleLogout() {
    try {
      await logoutAndClear();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <div className="bf-shell">
      <aside className="bf-sidebar" data-open={open}>
        <a href="/dashboard" className="bf-brand" aria-label="Buildflow — về tổng quan">
          <BrandMark />
          <span className="bf-brand-name">
            Build<em>flow</em>
          </span>
        </a>
        <nav className="bf-nav" aria-label="Điều hướng chính">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((it) => !it.adminOnly || admin);
            if (!items.length) return null;
            return (
              <React.Fragment key={group.title}>
                <div className="bf-nav-group">{group.title}</div>
                {items.map((it) => (
                  <a key={it.href} href={it.href} aria-current={pathname === it.href ? 'page' : undefined}>
                    {it.label}
                  </a>
                ))}
              </React.Fragment>
            );
          })}
        </nav>
        <div className="bf-nav-user">
          <div className="bf-nav-user-id">
            <span className="bf-avatar" aria-hidden="true">
              {initials(auth.user.fullName)}
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="bf-nav-user-name">{auth.user.fullName}</span>
              <br />
              <span className="bf-nav-user-role">{auth.roles[0]?.name ?? auth.user.userType}</span>
            </span>
          </div>
          <a
            href="/profile"
            style={{ color: 'var(--bf-text-on-ink)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}
          >
            Hồ sơ cá nhân
          </a>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'var(--bf-text-on-ink)',
              borderRadius: 'var(--bf-r-control)',
              padding: '6px 10px',
              font: 'inherit',
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      <button className="bf-scrim" aria-label="Đóng menu" data-open={open} onClick={() => setOpen(false)} />

      <div className="bf-main">
        <header className="bf-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="bf-burger" aria-label="Mở menu" onClick={() => setOpen((v) => !v)}>
              ☰
            </button>
            <span className="bf-topbar-title">{pageTitle(pathname)}</span>
          </div>
          <div className="bf-topbar-side">
            <span>{auth.user.email}</span>
          </div>
        </header>
        <main className="bf-content">{children}</main>
      </div>
    </div>
  );
}
