import { Be_Vietnam_Pro, Inter } from 'next/font/google';
import * as React from 'react';
import '@/styles/tokens.css';
import './globals.css';

/** DashCode stage 1: Inter is the primary font; Be Vietnam Pro stays loaded
 *  as the fallback chain (--font-be-vietnam-pro) for Vietnamese glyphs. */
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

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
    <html lang="vi" className={`${inter.variable} ${beVietnamPro.variable}`}>
      <body>{children}</body>
    </html>
  );
}
