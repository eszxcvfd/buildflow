import * as React from 'react';

/**
 * Nhận diện Buildflow — DashCode stage 1: ô slate-900, góc cắt primary-500.
 * SVG nội tuyến, không cần asset ngoài.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="#0F172A" />
      {/* góc cutting — nhấn primary */}
      <path d="M17 4h7v7" stroke="#4669FA" strokeWidth="2.4" />
      {/* nét "B" dựng khối — như đường gấp bản vẽ */}
      <path
        d="M8 22V8h6.2a3.4 3.4 0 0 1 0 6.8H8h6.6a3.6 3.6 0 0 1 0 7.2H8Z"
        stroke="#F1F5F9"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
