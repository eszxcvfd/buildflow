import * as React from 'react';
import { BrandMark } from '@/components/layout/BrandMark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bf-auth">
      <div className="bf-auth-card">
        <a href="/login" className="bf-auth-brand" aria-label="Buildflow">
          <BrandMark size={34} />
          <span className="bf-brand-name">
            Build<em>flow</em>
          </span>
        </a>
        {children}
        <p className="bf-auth-foot">
          Sàn điều hành thi công — dự án, nhà thầu, công nhân trong một nơi.
        </p>
      </div>
    </div>
  );
}
