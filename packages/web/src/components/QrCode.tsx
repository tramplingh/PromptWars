import qrcode from 'qrcode-generator';
import { memo, useMemo } from 'react';

/**
 * QR code rendered as plain SVG rectangles (no innerHTML, CSP-safe). The text
 * is also shown next to it, so the QR itself is decorative for screen readers.
 */
export const QrCode = memo(function QrCode({
  value,
  size = 220,
}: {
  value: string;
  size?: number;
}) {
  const { count, cells } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const dark: [number, number][] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push([r, c]);
    return { count: n, cells: dark };
  }, [value]);

  const quiet = 2;
  const span = count + quiet * 2;
  return (
    <svg
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#ffffff" />
      <path
        fill="#0f172a"
        d={cells.map(([r, c]) => `M${c + quiet},${r + quiet}h1v1h-1z`).join('')}
      />
    </svg>
  );
});
