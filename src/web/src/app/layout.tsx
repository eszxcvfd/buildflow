export const metadata = { title: 'Buildflow Web' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem' }}>{children}</body>
    </html>
  );
}
