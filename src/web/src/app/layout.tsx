import { Be_Vietnam_Pro } from 'next/font/google';
import * as React from 'react';
import '@/styles/tokens.css';
import './globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
});

export const metadata = {
  title: 'Buildflow — Quản lý thi công',
  description: 'Điều hành dự án, nhà thầu và công nhân trong một bảng điều khiển.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body>{children}</body>
    </html>
  );
}
