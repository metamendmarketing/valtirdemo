/**
 * exportPlan.ts – v2
 * Renders at 2× logical size for pixel-crisp output.
 * All layout values are in "logical px"; the canvas is scaled ×2.
 */

interface Product {
  id: string; name: string; color: string; length: number; width: number; price: number;
}
interface PlacedItem  { instanceId: string; productId: string; lat: number; lng: number; rotation: number; }
interface BlueprintItem { instanceId: string; productId: string; x: number; y: number; rotation: number; }

export interface ExportParams {
  planName: string;
  placedItems: PlacedItem[];
  blueprintItems: BlueprintItem[];
  products: Product[];
  viewMode: 'map' | 'blueprint';
  mapCenter: { lat: number; lng: number };
  zoom: number;
  mapType: string;
  blueprintUrl: string | null;
  bpScale: number;
  apiKey: string;
}

const COLOR_MAP: Record<string, string> = {
  'bg-orange-500': '#f97316', 'bg-orange-600': '#ea580c', 'bg-orange-400': '#fb923c',
  'bg-red-600': '#dc2626',   'bg-red-500': '#ef4444',
  'bg-zinc-500': '#71717a',  'bg-zinc-400': '#a1a1aa',
  'bg-yellow-500': '#eab308',
};

async function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function mkMercator(mapCenter: { lat: number; lng: number }, zoom: number, W: number, H: number) {
  const scale = Math.pow(2, zoom) * 256;
  const mercX  = (lng: number) => scale * (lng + 180) / 360;
  const mercYf = (lat: number) => scale * (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2;
  const cx = mercX(mapCenter.lng), cy = mercYf(mapCenter.lat);
  return { toCanvas: (lat: number, lng: number) => ({ x: W / 2 + (mercX(lng) - cx), y: H / 2 + (mercYf(lat) - cy) }) };
}

export async function exportPlan(p: ExportParams): Promise<void> {
  const logoImg = await loadImage('/valtir/demo/valtir-logo.png');
  // ── Layout (logical px, canvas rendered at 2×) ──────────────────
  const DPR  = 2;
  const LW   = 1240;   // logical width
  const LH   = 780;    // logical height
  const CW   = LW * DPR;
  const CH   = LH * DPR;

  const HEADER_H = 80;
  const FOOTER_H = 40;
  const PANEL_W  = 360;
  const VIS_W    = LW - PANEL_W;
  const VIS_H    = LH - HEADER_H - FOOTER_H;  // 660

  const canvas = document.createElement('canvas');
  canvas.width = CW; canvas.height = CH;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(DPR, DPR);   // all drawing in logical px from here

  // ── Palette ──────────────────────────────────────────────────────
  const C = {
    bg:      '#0b1120',
    panel:   '#111827',
    panelB:  '#1a2438',
    border:  '#1f2e47',
    accent:  '#f97316',
    accentD: '#c2540a',
    text:    '#f1f5f9',
    sub:     '#94a3b8',
    muted:   '#475569',
    white:   '#ffffff',
  };

  const font = (size: number, weight = 400, mono = false) =>
    `${weight} ${size}px ${mono ? 'ui-monospace,monospace' : 'system-ui,-apple-system,sans-serif'}`;

  // ── Background ───────────────────────────────────────────────────
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, LW, LH);

  // ── Header ───────────────────────────────────────────────────────
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 0, LW, HEADER_H);
  // Bottom border
  ctx.fillStyle = C.border;
  ctx.fillRect(0, HEADER_H - 1, LW, 1);

  if (logoImg) {
    const scale = 36 / logoImg.naturalHeight;
    ctx.drawImage(logoImg, 28, 22, logoImg.naturalWidth * scale, 36);
  }

  // Plan name — centered, large, prominent
  ctx.fillStyle = C.white;
  ctx.font = font(22, 700);
  ctx.textAlign = 'center';
  ctx.fillText(p.planName, VIS_W / 2, 57);
  ctx.textAlign = 'left';

  // Date — right-aligned
  ctx.fillStyle = C.muted;
  ctx.font = font(11, 400);
  ctx.textAlign = 'right';
  ctx.fillText(
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    LW - PANEL_W - 20, 52,
  );
  ctx.textAlign = 'left';

  // ── Footer ───────────────────────────────────────────────────────
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, LH - FOOTER_H, LW, FOOTER_H);
  ctx.fillStyle = C.border;
  ctx.fillRect(0, LH - FOOTER_H, LW, 1);

  ctx.fillStyle = C.muted;
  ctx.font = font(10, 400);
  ctx.fillText('valtirrentals.com · Exported ' + new Date().toLocaleString(), 20, LH - 14);

  ctx.fillStyle = C.accent;
  ctx.font = font(10, 700);
  ctx.textAlign = 'right';
  ctx.fillText('Request a Quote →', LW - 20, LH - 14);
  ctx.textAlign = 'left';

  // ── Right data panel ─────────────────────────────────────────────
  ctx.fillStyle = C.panelB;
  ctx.fillRect(VIS_W, HEADER_H, PANEL_W, VIS_H);
  // Left border
  ctx.fillStyle = C.border;
  ctx.fillRect(VIS_W, HEADER_H, 1, VIS_H);

  const PX  = VIS_W + 20;           // panel content left
  const PR  = LW - 20;              // panel content right
  let   py  = HEADER_H + 24;

  // "BARRIER BREAKDOWN" heading
  ctx.fillStyle = C.muted;
  ctx.font = font(9, 700);
  ctx.fillText('BARRIER BREAKDOWN', PX, py);
  py += 20;

  // Collect items
  const allItems  = [...p.placedItems, ...p.blueprintItems];
  const breakdown = p.products
    .map(prod => ({ product: prod, count: allItems.filter(i => i.productId === prod.id).length }))
    .filter(({ count }) => count > 0);

  // Dynamic row height — shrink if many products to avoid overflow
  const MAX_LIST_H = 280;
  const rowH = breakdown.length > 0 ? Math.min(26, Math.floor(MAX_LIST_H / breakdown.length)) : 26;

  for (const { product, count } of breakdown) {
    const color = COLOR_MAP[product.color] ?? C.accent;

    // Color swatch
    ctx.fillStyle = color;
    ctx.fillRect(PX, py - 11, 3, 17);

    // Product name — truncate to fit
    ctx.fillStyle = C.text;
    ctx.font = font(11, 500);
    const maxNameW = 150;
    let name = product.name;
    while (name.length > 4 && ctx.measureText(name).width > maxNameW) name = name.slice(0, -1);
    if (name !== product.name) name += '…';
    ctx.fillText(name, PX + 10, py);

    // Count × cost — right-aligned
    ctx.fillStyle = color;
    ctx.font = font(10, 700, true);
    ctx.textAlign = 'right';
    ctx.fillText(`${count}×  $${(count * product.price).toLocaleString()}/day`, PR, py);
    ctx.textAlign = 'left';

    py += rowH;
  }

  // Divider
  py += 12;
  ctx.fillStyle = C.border;
  ctx.fillRect(PX, py, PANEL_W - 40, 1);
  py += 20;

  // "EST. DAILY COST" label — ensure enough room before big number
  ctx.fillStyle = C.muted;
  ctx.font = font(9, 700);
  ctx.fillText('EST. DAILY COST', PX, py);
  py += 60;   // 9px label + gap + 44px cap height needs generous spacing

  const total = breakdown.reduce((s, { product, count }) => s + product.price * count, 0);

  ctx.fillStyle = C.white;
  ctx.font = font(44, 800);
  ctx.fillText('$' + total.toLocaleString(), PX, py);
  py += 22;

  ctx.fillStyle = C.sub;
  ctx.font = font(11, 400);
  ctx.fillText(`/day · ${allItems.length} unit${allItems.length !== 1 ? 's' : ''}`, PX, py);
  py += 28;


  // ── Visual area (clipped) ────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HEADER_H, VIS_W, VIS_H);
  ctx.clip();

  if (p.viewMode === 'blueprint' && p.blueprintUrl) {
    const bpImg = await loadImage(p.blueprintUrl);
    if (bpImg) {
      const sc  = Math.min(VIS_W / bpImg.naturalWidth, VIS_H / bpImg.naturalHeight) * 0.92;
      const iw  = bpImg.naturalWidth * sc, ih = bpImg.naturalHeight * sc;
      const ix  = (VIS_W - iw) / 2;
      const iy  = HEADER_H + (VIS_H - ih) / 2;
      ctx.drawImage(bpImg, ix, iy, iw, ih);

      for (const item of p.blueprintItems) {
        const prod  = p.products.find(q => q.id === item.productId); if (!prod) continue;
        const color = COLOR_MAP[prod.color] ?? C.accent;
        const bw    = Math.max(6, prod.length * p.bpScale * sc);
        const bh    = Math.max(2, prod.width  * p.bpScale * sc);
        ctx.save();
        ctx.translate(ix + item.x * iw, iy + item.y * ih);
        ctx.rotate(item.rotation * Math.PI / 180);
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = color;
        ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
        ctx.restore();
      }
    }
  } else {
    // Map: try Google Static Maps (crossOrigin)
    const staticUrl =
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=${p.mapCenter.lat},${p.mapCenter.lng}` +
      `&zoom=${Math.round(p.zoom)}&size=860x660&scale=2` +
      `&maptype=${p.mapType}&key=${p.apiKey}`;

    const mapImg = await loadImage(staticUrl, true);
    if (mapImg) {
      ctx.drawImage(mapImg, 0, HEADER_H, VIS_W, VIS_H);
    } else {
      // Fallback: dark satellite-style gradient
      const grad = ctx.createLinearGradient(0, HEADER_H, 0, HEADER_H + VIS_H);
      grad.addColorStop(0, '#091a0e'); grad.addColorStop(1, '#0d2414');
      ctx.fillStyle = grad;
      ctx.fillRect(0, HEADER_H, VIS_W, VIS_H);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let gx = 40; gx < VIS_W; gx += 60)
        for (let gy = 40; gy < VIS_H; gy += 60) {
          ctx.beginPath(); ctx.arc(gx, HEADER_H + gy, 1.5, 0, Math.PI * 2); ctx.fill();
        }
    }

    // Overlay barriers using Web Mercator projection
    const mpp  = 156543.03392 * Math.cos(p.mapCenter.lat * Math.PI / 180) / Math.pow(2, p.zoom);
    const ppf  = 1 / (mpp * 3.28084);
    const proj = mkMercator(p.mapCenter, p.zoom, VIS_W, VIS_H);

    for (const item of p.placedItems) {
      const prod  = p.products.find(q => q.id === item.productId); if (!prod) continue;
      const color = COLOR_MAP[prod.color] ?? C.accent;
      const { x, y } = proj.toCanvas(item.lat, item.lng);
      const bw = Math.max(10, prod.length * ppf), bh = Math.max(4, prod.width * ppf);
      ctx.save();
      ctx.translate(x, HEADER_H + y);
      ctx.rotate(item.rotation * Math.PI / 180);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
      ctx.restore();
    }
  }

  ctx.restore();

  // Panel left border (drawn after clip restore so it's on top)
  ctx.fillStyle = C.border;
  ctx.fillRect(VIS_W, HEADER_H, 1, VIS_H);

  // ── Download ─────────────────────────────────────────────────────
  try {
    const url  = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `valtir-plan-${Date.now()}.png`;
    link.href = url;
    link.click();
  } catch {
    alert('The map background could not be included due to browser security restrictions, but all plan data is complete.');
  }
}
