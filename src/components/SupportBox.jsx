import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const ADDRESS = 'bc1qd3ms20a3f6tsce4fvl2ktj6ftq500knwnfr0fq';
// QR code for "bitcoin:<address>" (29x29 modules), generated offline and checked by decoding it.
const QR_N = 29;
const QR_PATH = 'M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM12 0h1v1h-1zM14 0h1v1h-1zM16 0h1v1h-1zM19 0h1v1h-1zM20 0h1v1h-1zM22 0h1v1h-1zM23 0h1v1h-1zM24 0h1v1h-1zM25 0h1v1h-1zM26 0h1v1h-1zM27 0h1v1h-1zM28 0h1v1h-1zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h1v1h-1zM10 1h1v1h-1zM14 1h1v1h-1zM15 1h1v1h-1zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM12 2h1v1h-1zM16 2h1v1h-1zM18 2h1v1h-1zM19 2h1v1h-1zM20 2h1v1h-1zM22 2h1v1h-1zM24 2h1v1h-1zM25 2h1v1h-1zM26 2h1v1h-1zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM8 3h1v1h-1zM9 3h1v1h-1zM10 3h1v1h-1zM13 3h1v1h-1zM14 3h1v1h-1zM15 3h1v1h-1zM17 3h1v1h-1zM20 3h1v1h-1zM22 3h1v1h-1zM24 3h1v1h-1zM25 3h1v1h-1zM26 3h1v1h-1zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM9 4h1v1h-1zM11 4h1v1h-1zM14 4h1v1h-1zM16 4h1v1h-1zM19 4h1v1h-1zM22 4h1v1h-1zM24 4h1v1h-1zM25 4h1v1h-1zM26 4h1v1h-1zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM12 5h1v1h-1zM15 5h1v1h-1zM17 5h1v1h-1zM18 5h1v1h-1zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM23 6h1v1h-1zM24 6h1v1h-1zM25 6h1v1h-1zM26 6h1v1h-1zM27 6h1v1h-1zM28 6h1v1h-1zM9 7h1v1h-1zM10 7h1v1h-1zM11 7h1v1h-1zM14 7h1v1h-1zM16 7h1v1h-1zM19 7h1v1h-1zM20 7h1v1h-1zM0 8h1v1h-1zM1 8h1v1h-1zM2 8h1v1h-1zM3 8h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM9 8h1v1h-1zM12 8h1v1h-1zM13 8h1v1h-1zM15 8h1v1h-1zM16 8h1v1h-1zM17 8h1v1h-1zM21 8h1v1h-1zM23 8h1v1h-1zM25 8h1v1h-1zM27 8h1v1h-1zM3 9h1v1h-1zM4 9h1v1h-1zM5 9h1v1h-1zM7 9h1v1h-1zM8 9h1v1h-1zM10 9h1v1h-1zM11 9h1v1h-1zM14 9h1v1h-1zM18 9h1v1h-1zM19 9h1v1h-1zM20 9h1v1h-1zM21 9h1v1h-1zM22 9h1v1h-1zM23 9h1v1h-1zM24 9h1v1h-1zM27 9h1v1h-1zM28 9h1v1h-1zM0 10h1v1h-1zM2 10h1v1h-1zM3 10h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM10 10h1v1h-1zM12 10h1v1h-1zM14 10h1v1h-1zM15 10h1v1h-1zM17 10h1v1h-1zM18 10h1v1h-1zM20 10h1v1h-1zM23 10h1v1h-1zM24 10h1v1h-1zM25 10h1v1h-1zM26 10h1v1h-1zM0 11h1v1h-1zM2 11h1v1h-1zM3 11h1v1h-1zM12 11h1v1h-1zM14 11h1v1h-1zM19 11h1v1h-1zM21 11h1v1h-1zM24 11h1v1h-1zM25 11h1v1h-1zM27 11h1v1h-1zM0 12h1v1h-1zM1 12h1v1h-1zM2 12h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM7 12h1v1h-1zM8 12h1v1h-1zM9 12h1v1h-1zM10 12h1v1h-1zM13 12h1v1h-1zM17 12h1v1h-1zM20 12h1v1h-1zM21 12h1v1h-1zM23 12h1v1h-1zM26 12h1v1h-1zM0 13h1v1h-1zM1 13h1v1h-1zM2 13h1v1h-1zM3 13h1v1h-1zM4 13h1v1h-1zM5 13h1v1h-1zM11 13h1v1h-1zM12 13h1v1h-1zM14 13h1v1h-1zM16 13h1v1h-1zM18 13h1v1h-1zM19 13h1v1h-1zM22 13h1v1h-1zM23 13h1v1h-1zM24 13h1v1h-1zM25 13h1v1h-1zM26 13h1v1h-1zM28 13h1v1h-1zM2 14h1v1h-1zM4 14h1v1h-1zM6 14h1v1h-1zM12 14h1v1h-1zM15 14h1v1h-1zM20 14h1v1h-1zM21 14h1v1h-1zM23 14h1v1h-1zM24 14h1v1h-1zM25 14h1v1h-1zM26 14h1v1h-1zM1 15h1v1h-1zM7 15h1v1h-1zM8 15h1v1h-1zM10 15h1v1h-1zM11 15h1v1h-1zM12 15h1v1h-1zM15 15h1v1h-1zM16 15h1v1h-1zM22 15h1v1h-1zM24 15h1v1h-1zM25 15h1v1h-1zM4 16h1v1h-1zM5 16h1v1h-1zM6 16h1v1h-1zM7 16h1v1h-1zM8 16h1v1h-1zM13 16h1v1h-1zM15 16h1v1h-1zM16 16h1v1h-1zM17 16h1v1h-1zM18 16h1v1h-1zM23 16h1v1h-1zM26 16h1v1h-1zM27 16h1v1h-1zM28 16h1v1h-1zM0 17h1v1h-1zM3 17h1v1h-1zM4 17h1v1h-1zM5 17h1v1h-1zM10 17h1v1h-1zM11 17h1v1h-1zM14 17h1v1h-1zM16 17h1v1h-1zM19 17h1v1h-1zM20 17h1v1h-1zM21 17h1v1h-1zM22 17h1v1h-1zM24 17h1v1h-1zM26 17h1v1h-1zM27 17h1v1h-1zM28 17h1v1h-1zM0 18h1v1h-1zM4 18h1v1h-1zM6 18h1v1h-1zM10 18h1v1h-1zM12 18h1v1h-1zM15 18h1v1h-1zM16 18h1v1h-1zM22 18h1v1h-1zM23 18h1v1h-1zM25 18h1v1h-1zM0 19h1v1h-1zM3 19h1v1h-1zM4 19h1v1h-1zM5 19h1v1h-1zM11 19h1v1h-1zM18 19h1v1h-1zM24 19h1v1h-1zM25 19h1v1h-1zM27 19h1v1h-1zM28 19h1v1h-1zM0 20h1v1h-1zM1 20h1v1h-1zM2 20h1v1h-1zM4 20h1v1h-1zM5 20h1v1h-1zM6 20h1v1h-1zM10 20h1v1h-1zM12 20h1v1h-1zM13 20h1v1h-1zM14 20h1v1h-1zM17 20h1v1h-1zM20 20h1v1h-1zM21 20h1v1h-1zM22 20h1v1h-1zM23 20h1v1h-1zM24 20h1v1h-1zM26 20h1v1h-1zM27 20h1v1h-1zM8 21h1v1h-1zM11 21h1v1h-1zM13 21h1v1h-1zM16 21h1v1h-1zM18 21h1v1h-1zM19 21h1v1h-1zM20 21h1v1h-1zM24 21h1v1h-1zM25 21h1v1h-1zM26 21h1v1h-1zM27 21h1v1h-1zM28 21h1v1h-1zM0 22h1v1h-1zM1 22h1v1h-1zM2 22h1v1h-1zM3 22h1v1h-1zM4 22h1v1h-1zM5 22h1v1h-1zM6 22h1v1h-1zM8 22h1v1h-1zM9 22h1v1h-1zM10 22h1v1h-1zM12 22h1v1h-1zM13 22h1v1h-1zM15 22h1v1h-1zM17 22h1v1h-1zM19 22h1v1h-1zM20 22h1v1h-1zM22 22h1v1h-1zM24 22h1v1h-1zM26 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM11 23h1v1h-1zM14 23h1v1h-1zM18 23h1v1h-1zM20 23h1v1h-1zM24 23h1v1h-1zM27 23h1v1h-1zM28 23h1v1h-1zM0 24h1v1h-1zM2 24h1v1h-1zM3 24h1v1h-1zM4 24h1v1h-1zM6 24h1v1h-1zM8 24h1v1h-1zM11 24h1v1h-1zM12 24h1v1h-1zM13 24h1v1h-1zM14 24h1v1h-1zM15 24h1v1h-1zM16 24h1v1h-1zM17 24h1v1h-1zM20 24h1v1h-1zM21 24h1v1h-1zM22 24h1v1h-1zM23 24h1v1h-1zM24 24h1v1h-1zM25 24h1v1h-1zM26 24h1v1h-1zM27 24h1v1h-1zM0 25h1v1h-1zM2 25h1v1h-1zM3 25h1v1h-1zM4 25h1v1h-1zM6 25h1v1h-1zM8 25h1v1h-1zM11 25h1v1h-1zM13 25h1v1h-1zM20 25h1v1h-1zM26 25h1v1h-1zM28 25h1v1h-1zM0 26h1v1h-1zM2 26h1v1h-1zM3 26h1v1h-1zM4 26h1v1h-1zM6 26h1v1h-1zM8 26h1v1h-1zM9 26h1v1h-1zM13 26h1v1h-1zM14 26h1v1h-1zM15 26h1v1h-1zM17 26h1v1h-1zM22 26h1v1h-1zM23 26h1v1h-1zM24 26h1v1h-1zM26 26h1v1h-1zM27 26h1v1h-1zM0 27h1v1h-1zM6 27h1v1h-1zM8 27h1v1h-1zM9 27h1v1h-1zM10 27h1v1h-1zM11 27h1v1h-1zM15 27h1v1h-1zM16 27h1v1h-1zM18 27h1v1h-1zM19 27h1v1h-1zM20 27h1v1h-1zM21 27h1v1h-1zM25 27h1v1h-1zM27 27h1v1h-1zM0 28h1v1h-1zM1 28h1v1h-1zM2 28h1v1h-1zM3 28h1v1h-1zM4 28h1v1h-1zM5 28h1v1h-1zM6 28h1v1h-1zM8 28h1v1h-1zM9 28h1v1h-1zM10 28h1v1h-1zM13 28h1v1h-1zM14 28h1v1h-1zM17 28h1v1h-1zM22 28h1v1h-1zM24 28h1v1h-1zM26 28h1v1h-1z';

export default function SupportBox() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(ADDRESS); } catch {
      const t = document.createElement('textarea');
      t.value = ADDRESS; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(t);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 glass rounded-2xl p-4 max-w-xl">
      <a href={`bitcoin:${ADDRESS}`} aria-label="Bitcoin QR code" className="shrink-0 rounded-xl bg-white p-2">
        <svg viewBox={`-2 -2 ${QR_N + 4} ${QR_N + 4}`} width="112" height="112" shapeRendering="crispEdges" role="img" aria-label="Bitcoin address QR code">
          <rect x="-2" y="-2" width={QR_N + 4} height={QR_N + 4} fill="#fff" />
          <path d={QR_PATH} fill="#000" />
        </svg>
      </a>
      <div className="min-w-0 text-center sm:text-left">
        <div className="text-sm font-semibold text-foreground">Support me ₿</div>
        <p className="text-xs mt-0.5">If you enjoy the site, you can send a little Bitcoin. Thank you!</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="text-[11px] sm:text-xs break-all select-all bg-black/30 rounded-lg px-2 py-1.5 text-foreground/90">{ADDRESS}</code>
          <button onClick={copy} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-foreground" aria-label="Copy address">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
