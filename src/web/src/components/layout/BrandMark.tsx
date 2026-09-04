import * as React from 'react';

/**
 * Nhận diện Buildflow: ô bản vẽ navy, góc cắt cam an toàn — "corner mark"
 * gợi khung bản vẽ thi công. SVG nội tuyến, không cần asset ngoài.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="#14243D" />
      {/* góc cutting — nhấn cam an toàn */}
      <path d="M17 4h7v7" stroke="#E8590C" strokeWidth="2.4" />
      {/* nét "B" dựng khối — như đường gấp bản vẽ */}
      <path
        d="M8 22V8h6.2a3.4 3.4 0 0 1 0 6.8H8h6.6a3.6 3.6 0 0 1 0 7.2H8Z"
        stroke="#E8EDF5"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
