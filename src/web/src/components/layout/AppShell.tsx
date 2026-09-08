'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { logoutAndClear } from '@/features/auth';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Menu } from '@/components/ui/menu/Menu';
import { Tooltip } from '@/components/ui/tooltip/Tooltip';
import { BrandMark } from './BrandMark';
import { AUTH_CHANGED_EVENT, getAuth, isTokenExpired, type StoredAuth } from '@/lib/auth/storage';
// ORG-SRS-005 (issue #28) — nguồn role duy nhất: lib/auth/roles.ts
// (roles.code thật: ADMIN + PROJECT_MANAGER; không alias project_role).
import { canViewResourceDirectory, hasAdminRole } from '@/lib/auth/roles';

interface NavItem {
  href: string;
  label: string;
  /** mã role được phép thấy; undefined = mọi người đã đăng nhập */
  adminOnly?: boolean;
  /**
   * ORG-SRS-005 (issue #28) — hiển thị cho ADMIN + PROJECT_MANAGER
   * (directory tra cứu nguồn lực, read-only).
   */
  resourceViewer?: boolean;
}

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Điều hành',
    items: [
      { href: '/dashboard', label: 'Tổng quan' },
      { href: '/projects', label: 'Dự án' },
      // ORG-SRS-008 (issue #31) — tự kiểm tra điều kiện nhận việc:
      // mọi user đã đăng nhập (GET /api/v1/eligibility/me, không check role).
      { href: '/my-eligibility', label: 'Điều kiện nhận việc của tôi' },
    ],
  },
  {
    title: 'Đối tác thi công',
    items: [{ href: '/contractors', label: 'Nhà thầu' }],
  },
  {
    title: 'Nguồn lực',
    items: [
      { href: '/resources', label: 'Tra cứu nguồn lực', resourceViewer: true },
      { href: '/workers', label: 'Công nhân', adminOnly: true },
      // ORG-SRS-006 (issue #29) — đội thi công: read + write cho ADMIN + PROJECT_MANAGER.
      { href: '/crews', label: 'Đội thi công', resourceViewer: true },
      { href: '/trades', label: 'Ngành nghề', adminOnly: true },
      // PRJ-SRS-004 (issue #35) — loại công việc: read ADMIN + PROJECT_MANAGER.
      { href: '/work-types', label: 'Loại công việc', resourceViewer: true },
      // PRJ-SRS-008 (issue #39) — mẫu công việc: read ADMIN + PROJECT_MANAGER.
      { href: '/work-order-templates', label: 'Mẫu công việc', resourceViewer: true },
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
  ['/my-eligibility', 'Điều kiện nhận việc của tôi'],
  ['/contractors', 'Nhà thầu'],
  ['/resources', 'Tra cứu nguồn lực'],
  ['/workers', 'Công nhân'],
  ['/crews', 'Đội thi công'],
  ['/trades', 'Ngành nghề'],
  ['/work-types', 'Loại công việc'],
  ['/work-order-templates', 'Mẫu công việc'],
  ['/admin/users', 'Tài khoản'],
  ['/admin/audit-logs', 'Nhật ký thao tác'],
  ['/profile', 'Hồ sơ cá nhân'],
];

/**
 * DashCode stage 3 — inline stroke icons (18px) cho menu-link.
 * Inline SVG để không thêm dependency runtime (@iconify/react fetch mạng).
 */
const NAV_ICON_PATHS: Record<string, React.ReactNode> = {
  '/dashboard': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm10 0a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V6ZM4 16a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4Zm10 0a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4Z"
    />
  ),
  '/projects': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Zm-9-3H5a1 1 0 0 0-1 1v2h7V5a1 1 0 0 0-1-1Z"
    />
  ),
  '/my-eligibility': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  ),
  '/contractors': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.008v.008H6.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM10.5 6.75h.008v.008h-.008V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM14.25 6.75h.008v.008h-.008V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
    />
  ),
  '/resources': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
    />
  ),
  '/workers': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
    />
  ),
  '/crews': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
    />
  ),
  '/trades': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
    />
  ),
  '/work-order-templates': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h6m-6 4h6M9 8h6M5 3h11.25a1.5 1.5 0 0 1 1.06.44l2.25 2.25a1.5 1.5 0 0 1 .44 1.06V21a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3.5 21V4.5A1.5 1.5 0 0 1 5 3Z"
    />
  ),
  '/admin/users': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  ),
  '/admin/audit-logs': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75"
    />
  ),
};

function NavIcon({ href }: { href: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
      className="bf-nav-icon"
    >
      {NAV_ICON_PATHS[href] ?? NAV_ICON_PATHS['/projects']}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

function isAdmin(roles: Array<{ code: string }>): boolean {
  return hasAdminRole(roles.map((r) => r.code));
}

function canViewResources(roles: Array<{ code: string }>): boolean {
  return canViewResourceDirectory(roles.map((r) => r.code));
}

function pageTitle(pathname: string): string {
  const hit = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? hit[1] : 'Buildflow';
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

const COLLAPSED_KEY = 'bf.sidebar.collapsed';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [auth, setAuth] = React.useState<StoredAuth | null>(null);
  const [checked, setChecked] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [paletteQuery, setPaletteQuery] = React.useState('');
  const [paletteActive, setPaletteActive] = React.useState(0);

  React.useEffect(() => {
    const a = getAuth();
    if (!a || isTokenExpired(a)) {
      router.replace('/login?reason=session-expired');
      return;
    }
    setAuth(a);
    setChecked(true);
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === '1');
    } catch {
      /* private mode — giữ mặc định mở rộng */
    }
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

  // Search palette: links lọc theo role (auth null → chỉ mục public) + /profile.
  // Đặt TRƯỚC early return guard để giữ thứ tự hooks ổn định.
  const paletteLinks = React.useMemo(() => {
    const codes = (auth?.roles ?? []).map((r) => r.code);
    const adminLike = hasAdminRole(codes);
    const viewerLike = canViewResourceDirectory(codes);
    const links: Array<{ href: string; label: string; group: string }> = [];
    for (const group of NAV_GROUPS) {
      for (const it of group.items) {
        if (it.adminOnly && !adminLike) continue;
        if (it.resourceViewer && !viewerLike) continue;
        links.push({ href: it.href, label: it.label, group: group.title });
      }
    }
    links.push({ href: '/profile', label: 'Hồ sơ cá nhân', group: 'Tài khoản' });
    return links;
  }, [auth]);

  const paletteResults = React.useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return paletteLinks;
    return paletteLinks.filter((l) => l.label.toLowerCase().includes(q));
  }, [paletteLinks, paletteQuery]);

  function openPalette() {
    setPaletteQuery('');
    setPaletteActive(0);
    setPaletteOpen(true);
  }

  function goPalette(href: string) {
    setPaletteOpen(false);
    router.push(href);
  }

  const toggleSidebar = React.useCallback(() => {
    // Mobile (≤900px, khớp breakpoint CSS): mở drawer phủ + scrim.
    // Desktop: thu gọn sidebar 248px → 72px icon-only.
    if (window.matchMedia('(max-width: 900px)').matches) {
      setOpen((v) => !v);
      return;
    }
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* private mode — bỏ qua persist */
      }
      return next;
    });
  }, []);

  if (!checked || !auth) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--bf-muted)' }}>
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  const admin = isAdmin(auth.roles);
  const resourceViewer = canViewResources(auth.roles);

  async function handleLogout() {
    try {
      await logoutAndClear();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <div className="bf-shell" data-collapsed={collapsed}>
      <aside className="bf-sidebar" data-open={open} data-collapsed={collapsed}>
        <a href="/dashboard" className="bf-brand" aria-label="Buildflow — về tổng quan">
          <BrandMark />
          <span className="bf-brand-name">
            Build<em>flow</em>
          </span>
        </a>
        <nav className="bf-nav" aria-label="Điều hướng chính">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((it) => {
              if (it.adminOnly) return admin;
              if (it.resourceViewer) return resourceViewer;
              return true;
            });
            if (!items.length) return null;
            return (
              <React.Fragment key={group.title}>
                <div className="bf-nav-group" aria-hidden={collapsed}>
                  {group.title}
                </div>
                {items.map((it) => {
                  const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                  return (
                    <Tooltip key={it.href} content={it.label} disabled={!collapsed}>
                      <a
                        href={it.href}
                        aria-current={active ? 'page' : undefined}
                      >
                        <NavIcon href={it.href} />
                        <span className="bf-nav-label">{it.label}</span>
                      </a>
                    </Tooltip>
                  );
                })}
              </React.Fragment>
            );
          })}
        </nav>
      </aside>

      <button className="bf-scrim" aria-label="Đóng menu" data-open={open} onClick={() => setOpen(false)} />

      <div className="bf-main">
        <header className="bf-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <Tooltip content="Mở menu">
              <button
                className="bf-burger"
                aria-label="Mở menu"
                aria-expanded={open}
                onClick={toggleSidebar}
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </Tooltip>
            <span className="bf-topbar-title">{pageTitle(pathname)}</span>
          </div>
          <div className="bf-topbar-side">
            <button type="button" className="bf-search-pill" onClick={openPalette} aria-label="Tìm kiếm trang">
              <SearchIcon />
              <span>Search…</span>
            </button>
            <Menu
              triggerLabel={
                <span className="bf-icon-badge-wrap">
                  <BellIcon />
                  <span className="bf-dot" aria-hidden="true" />
                </span>
              }
              triggerAriaLabel="Thông báo"
              triggerClassName="bf-bell-btn"
              items={[{ id: 'empty', label: 'Chưa có thông báo', disabled: true }]}
            />
            <span className="bf-topbar-email">{auth.user.email}</span>
            <div className="bf-profile-menu">
              <Menu
                triggerLabel={
                  <span className="bf-avatar-btn-label" aria-hidden="true">
                    {initials(auth.user.fullName)}
                  </span>
                }
                triggerAriaLabel="Mở menu tài khoản"
                triggerClassName="bf-avatar-btn h-9 w-9 shrink-0 rounded-full"
                header={
                  <>
                    <div className="bf-menu-header-name">{auth.user.fullName}</div>
                    <div className="bf-menu-header-email">{auth.user.email}</div>
                  </>
                }
                items={[
                  {
                    id: 'profile',
                    label: 'Hồ sơ cá nhân',
                    href: '/profile',
                    icon: (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    ),
                  },
                  {
                    id: 'logout',
                    label: 'Đăng xuất',
                    tone: 'danger',
                    icon: (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                      </svg>
                    ),
                  },
                ]}
                onSelect={(id) => {
                  if (id === 'logout') void handleLogout();
                }}
              />
            </div>
          </div>
        </header>
        <main className="bf-content">{children}</main>
      </div>
      {paletteOpen ? (
        <Dialog title="Tìm kiếm" open onClose={() => setPaletteOpen(false)} className="max-w-xl">
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="bf-search" style={{ maxWidth: 'none' }}>
              <SearchIcon />
              <input
                autoFocus
                className="bf-input"
                placeholder="Search…"
                aria-label="Từ khóa tìm kiếm trang"
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setPaletteActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && paletteResults.length > 0) {
                    goPalette(paletteResults[Math.min(paletteActive, paletteResults.length - 1)].href);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setPaletteActive((i) => Math.min(i + 1, paletteResults.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setPaletteActive((i) => Math.max(i - 1, 0));
                  }
                }}
              />
            </div>
            <div className="bf-palette-list" role="listbox" aria-label="Kết quả tìm kiếm">
              {paletteResults.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--bf-muted)' }}>
                  Không tìm thấy trang nào.
                </p>
              ) : (
                paletteResults.map((l, i) => (
                  <button
                    key={l.href}
                    type="button"
                    role="option"
                    aria-selected={i === paletteActive}
                    data-active={i === paletteActive}
                    className="bf-palette-item"
                    onMouseEnter={() => setPaletteActive(i)}
                    onClick={() => goPalette(l.href)}
                  >
                    <span>{l.label}</span>
                    <small>{l.group}</small>
                  </button>
                ))
              )}
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
