import * as React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/toast/Toaster';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <Toaster />
    </AppShell>
  );
}
