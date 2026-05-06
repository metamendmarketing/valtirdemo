'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Download, 
  Settings, 
  Box as BoxIcon,
  ShoppingCart,
  Info,
  Search as SearchIcon,
  Map as MapIcon,
  Satellite,
  MousePointer2,
  Hammer,
  FolderOpen,
  Ruler,
  ImageDown,
  X,
} from 'lucide-react';
import { usePlans } from '../../lib/usePlans';
import PlansDrawer from '../../components/PlansDrawer';
import { exportPlan } from '../../lib/exportPlan';
import {
  APIProvider,
  Map,
  MapControl,
  ControlPosition,
  useMap,
  AdvancedMarker
} from '@vis.gl/react-google-maps';

// GOOGLE MAPS API KEY
const GOOGLE_MAPS_API_KEY = 'AIzaSyDMitmU-u2F_EpOJx0td9jKDBuEJGSIAtQ';

interface Product {
  id: string;
  name: string;
  category: string;
  length: number; 
  width: number;
  weight: string;
  color: string;
  price: number; 
  image: string;
}

interface PlacedItem {
  instanceId: string;
  productId: string;
  lat: number;
  lng: number;
  rotation: number;
}

const PRODUCTS: Product[] = [
  // Yodock® Water-Filled Series
  { id: 'yodock-2001',   name: 'Yodock® 2001',                  category: 'Water Barrier', length: 6,    width: 1.5,  weight: '900 lbs (Full)',    color: 'bg-orange-500', price: 14,  image: 'https://www.valtirrentals.com/wp-content/uploads/2024/08/2001_Org_3Q-1-600x360.jpg' },
  { id: 'yodock-2001m',  name: 'Yodock® 2001M',                 category: 'Water Barrier', length: 6,    width: 1.5,  weight: '1,100 lbs (Full)', color: 'bg-orange-600', price: 18,  image: 'https://www.valtirrentals.com/wp-content/uploads/2024/08/2001M_Org_3Q-600x360.jpg' },
  { id: 'yodock-2001mb', name: 'Yodock® 2001MB',                category: 'Water Barrier', length: 6,    width: 1.5,  weight: '900 lbs (Full)',    color: 'bg-red-600',    price: 16,  image: 'https://www.valtirrentals.com/wp-content/uploads/2024/08/2001MB_Org_3Q-600x360.jpg' },
  { id: 'yodock-2001sl', name: 'Yodock® 2001SL',                category: 'Water Barrier', length: 6,    width: 1.5,  weight: '850 lbs (Full)',    color: 'bg-red-500',    price: 12,  image: 'https://www.valtirrentals.com/wp-content/uploads/2024/08/2001SL_Org_3Q-600x360.jpg' },
  { id: 'triton-tl2',    name: 'Triton Barrier® TL-2',          category: 'Water Barrier', length: 6.5,  width: 1.75, weight: '1,350 lbs (Full)', color: 'bg-orange-400', price: 15,  image: 'https://www.valtirrentals.com/wp-content/uploads/2024/08/Triton_Org_3Q-600x360.jpg' },

  // Steel & High Performance
  { id: 'armorzone',     name: 'ArmorZone® TL-2',               category: 'Steel Barrier', length: 6.5,  width: 1.5,  weight: '1,100 lbs (Full)', color: 'bg-zinc-500',   price: 24,  image: 'https://www.valtirrentals.com/wp-content/uploads/2024/08/ArmorZone_Org_3Q-600x360.jpg' },
  { id: 'armorzone-end', name: 'ArmorZone® End Treatment',      category: 'Steel Barrier', length: 7,    width: 1.5,  weight: '1,200 lbs (Full)', color: 'bg-yellow-500', price: 32,  image: 'https://www.valtirrentals.com/wp-content/uploads/2024/08/Armorzone_Yellow_Front-600x360.jpg' },
  { id: 'highwayguard',  name: 'HighwayGuard™',                 category: 'Steel Barrier', length: 13.1, width: 1.8,  weight: '1,200 lbs',        color: 'bg-zinc-400',   price: 42,  image: 'https://www.valtirrentals.com/wp-content/uploads/2024/08/Blah-600x360.jpg' },

];

// ── Shared helpers ───────────────────────────────────────────────────────────
function formatDist(ft: number): string {
  if (ft < 1)    return `${(ft * 12).toFixed(1)} in`;
  if (ft < 528)  return `${ft.toFixed(1)} ft`;
  return `${(ft / 5280).toFixed(2)} mi (${Math.round(ft).toLocaleString()} ft)`;
}
function haversine(p1: {lat:number,lng:number}, p2: {lat:number,lng:number}): number {
  const R = 20902231;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * MapHandler - Manages map-level interactions like Box Selection and Path Dragging
 */
const MapHandler = ({ 
  interaction, 
  setInteraction, 
  placedItems, 
  setSelectedIds,
  selectedProductId,
  setPlacedItems,
  setMeasureMapPts,
  externalCameraUpdateRef,
  mapCenter,
  zoom
}: any) => {
  const map = useMap();

  useEffect(() => {
    if (map && externalCameraUpdateRef?.current) {
      map.setCenter(mapCenter);
      map.setZoom(zoom);
    }
  }, [map, externalCameraUpdateRef?.current]);

  useEffect(() => {
    if (!map) return;

    const getDistance = (p1: any, p2: any) => {
      const R = 20902231; // Earth radius in feet
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLng = (p2.lng - p1.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const getHeading = (p1: any, p2: any) => {
      const dLng = (p2.lng - p1.lng) * Math.PI / 180;
      const y = Math.sin(dLng) * Math.cos(p2.lat * Math.PI / 180);
      const x = Math.cos(p1.lat * Math.PI / 180) * Math.sin(p2.lat * Math.PI / 180) -
                Math.sin(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.cos(dLng);
      const brng = Math.atan2(y, x) * 180 / Math.PI;
      return (brng + 360) % 360;
    };

    const handleMouseUp = () => {
      if (!interaction) return;

      const bounds = map.getBounds();
      const div = map.getDiv();
      if (!bounds || !div) {
        setInteraction(null);
        return;
      }

      const rect = div.getBoundingClientRect();
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();

      // Convert Screen Pixels to LatLng
      const screenToLatLng = (x: number, y: number) => {
        const lat = ne.lat() - (y / rect.height) * (ne.lat() - sw.lat());
        const lng = sw.lng() + (x / rect.width) * (ne.lng() - sw.lng());
        return { lat, lng };
      };

      const startLatLng = screenToLatLng(interaction.start.x, interaction.start.y);
      const endLatLng = screenToLatLng(interaction.end.x, interaction.end.y);

      if (interaction.type === 'BOX') {
        const minLat = Math.min(startLatLng.lat, endLatLng.lat);
        const maxLat = Math.max(startLatLng.lat, endLatLng.lat);
        const minLng = Math.min(startLatLng.lng, endLatLng.lng);
        const maxLng = Math.max(startLatLng.lng, endLatLng.lng);
        const newlySelected = placedItems.filter((item: any) => 
          item.lat >= minLat && item.lat <= maxLat && 
          item.lng >= minLng && item.lng <= maxLng
        ).map((i: any) => i.instanceId);
        setSelectedIds(newlySelected);
      } else if (interaction.type === 'PATH') {
        const product = PRODUCTS.find(p => p.id === selectedProductId) || PRODUCTS[0];
        const dist = getDistance(startLatLng, endLatLng);

        // ── End-to-end snap helper (screen-pixel space) ───────────
        const SNAP_PX = 24;
        const latLngToScreen = (lat: number, lng: number) => ({
          x: (lng - sw.lng()) / (ne.lng() - sw.lng()) * rect.width,
          y: (1 - (lat - sw.lat()) / (ne.lat() - sw.lat())) * rect.height,
        });
        const findMapSnap = (testLatLng: {lat:number,lng:number}, forProductId: string) => {
          const newProd = PRODUCTS.find(p => p.id === forProductId); if (!newProd) return null;
          const testSc = latLngToScreen(testLatLng.lat, testLatLng.lng);
          const FT_LAT = 1/364000;
          const FT_LNG = 1/(364000 * Math.cos(testLatLng.lat * Math.PI / 180));
          let best: {lat:number,lng:number,rotation:number,dist:number}|null = null;
          for (const item of placedItems) {
            const prod = PRODUCTS.find(p => p.id === item.productId); if (!prod) continue;
            const θ = (item.rotation - 90) * Math.PI / 180; // compass bearing → math angle
            const halfFt = prod.length / 2;
            for (const dir of [1,-1] as const) {
              const epLat = item.lat + dir * Math.cos(θ) * halfFt * FT_LAT;
              const epLng = item.lng + dir * Math.sin(θ) * halfFt * FT_LNG;
              const epSc = latLngToScreen(epLat, epLng);
              const d = Math.hypot(epSc.x - testSc.x, epSc.y - testSc.y);
              if (d < SNAP_PX && (!best || d < best.dist)) {
                const newHalfFt = newProd.length / 2;
                best = {
                  lat: epLat + dir * Math.cos(θ) * newHalfFt * FT_LAT,
                  lng: epLng + dir * Math.sin(θ) * newHalfFt * FT_LNG,
                  rotation: item.rotation,
                  dist: d,
                };
              }
            }
          }
          return best;
        };

        if (dist < 2) {
          const snap = findMapSnap(endLatLng, product.id);
          const pos = snap ?? { lat: endLatLng.lat, lng: endLatLng.lng, rotation: 0 };
          const newItem = { instanceId: Math.random().toString(36).substr(2, 9), productId: product.id, lat: pos.lat, lng: pos.lng, rotation: pos.rotation };
          setPlacedItems((prev: any) => [...prev, newItem]);
          setSelectedIds([newItem.instanceId]);
        } else {
          // Snap drag start to nearest endpoint if within threshold
          const findMapEndpoint = (testLL: {lat:number,lng:number}) => {
            const testSc = latLngToScreen(testLL.lat, testLL.lng);
            let best: {lat:number,lng:number,dist:number}|null = null;
            for (const item of placedItems) {
              const prod = PRODUCTS.find(p => p.id === item.productId); if (!prod) continue;
              const θ = (item.rotation - 90) * Math.PI / 180;
              const halfFt = prod.length / 2;
              const FT_LAT2 = 1/364000;
              const FT_LNG2 = 1/(364000 * Math.cos(item.lat * Math.PI / 180));
              for (const dir of [1,-1] as const) {
                const epLat = item.lat + dir * Math.cos(θ) * halfFt * FT_LAT2;
                const epLng = item.lng + dir * Math.sin(θ) * halfFt * FT_LNG2;
                const epSc = latLngToScreen(epLat, epLng);
                const d = Math.hypot(epSc.x - testSc.x, epSc.y - testSc.y);
                if (d < SNAP_PX && (!best || d < best.dist))
                  best = { lat: epLat, lng: epLng, dist: d };
              }
            }
            return best;
          };
          const ep = findMapEndpoint(startLatLng);
          const effectiveStart = ep ? { lat: ep.lat, lng: ep.lng } : startLatLng;
          const newDist = getDistance(effectiveStart, endLatLng);
          const heading = getHeading(effectiveStart, endLatLng);
          const count = Math.max(1, Math.floor(newDist / product.length));
          const newItems = [];
          for (let i = 0; i < count; i++) {
            // Place centers at exact productLen intervals: halfLen, 1.5L, 2.5L ...
            const frac = (product.length / 2 + i * product.length) / newDist;
            newItems.push({ instanceId: Math.random().toString(36).substr(2, 9), productId: product.id,
              lat: effectiveStart.lat + (endLatLng.lat - effectiveStart.lat) * frac,
              lng: effectiveStart.lng + (endLatLng.lng - effectiveStart.lng) * frac,
              rotation: heading + 90 });
          }
          setPlacedItems((prev: any) => [...prev, ...newItems]);
        }
      } else if (interaction.type === 'MEASURE') {
        // Commit measured points as lat/lng for MeasureHandler to draw
        setMeasureMapPts([startLatLng, endLatLng]);
      }

      setInteraction(null);
    };

    window.addEventListener('mouseup', handleMouseUp, { once: true });
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [map, interaction, placedItems, setSelectedIds, setInteraction, selectedProductId, setPlacedItems]);

  return null;
};

// ── MeasureHandler — tape measure for map mode ───────────────────────────────
const MeasureHandler = ({ active, pts, setPts }: { active: boolean; pts: {lat:number,lng:number}[]; setPts: React.Dispatch<React.SetStateAction<{lat:number,lng:number}[]>> }) => {
  const map = useMap();
  const polyRef   = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Click listener — only when active
  useEffect(() => {
    if (!map || !active) return;
    const listener = (map as any).addListener('click', (e: any) => {
      if (!e.latLng) return;
      const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setPts(prev => prev.length >= 2 ? [pt] : [...prev, pt]);
    });
    return () => (window as any).google?.maps?.event?.removeListener(listener);
  }, [map, active, setPts]);

  // Draw/update polyline + midpoint label whenever pts change
  useEffect(() => {
    if (!map) return;
    // Clean up previous drawings
    if (polyRef.current)   { polyRef.current.setMap(null);   polyRef.current = null; }
    if (markerRef.current) { markerRef.current.map = null;   markerRef.current = null; }
    if (pts.length < 2) return;
    const g = (window as any).google?.maps;
    if (!g) return;
    // Dashed polyline
    polyRef.current = new g.Polyline({
      path: pts,
      strokeColor: '#f97316',
      strokeOpacity: 0,
      strokeWeight: 0,
      icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#f97316', scale: 3 }, offset: '0', repeat: '14px' }],
      map,
    });
    // Distance label at midpoint via AdvancedMarkerElement
    const dist = haversine(pts[0], pts[1]);
    const mid  = { lat: (pts[0].lat + pts[1].lat) / 2, lng: (pts[0].lng + pts[1].lng) / 2 };
    const el   = document.createElement('div');
    el.style.cssText = 'background:#0f172a;border:1px solid #f97316;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:700;color:#fb923c;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.6);font-family:monospace';
    el.textContent   = formatDist(dist);
    markerRef.current = new g.marker.AdvancedMarkerElement({ position: mid, map, content: el, zIndex: 999 });
    return () => {
      if (polyRef.current)   { polyRef.current.setMap(null);   polyRef.current = null; }
      if (markerRef.current) { markerRef.current.map = null;   markerRef.current = null; }
    };
  }, [map, pts]);

  return null;
};

// ── Blueprint Mode ──────────────────────────────────────────────────────────

interface BlueprintItem {
  instanceId: string;
  productId: string;
  x: number; // fraction of image width (0–1)
  y: number; // fraction of image height (0–1)
  rotation: number;
}

const BlueprintCanvas = ({
  blueprintUrl, items, setItems,
  selectedIds, setSelectedIds,
  isDKeyPressed, selectedProductId, bpScale,
  calMode, calPts, onCalClick,
  measureBpPts, setMeasureBpPts,
}: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);

  // ── Viewport ──────────────────────────────────────────────────
  const [vpZoom, setVpZoom] = useState(1);
  const [vpPan,  setVpPan]  = useState({ x: 0, y: 0 });

  // ── Drag ──────────────────────────────────────────────────────
  type DragType = 'PATH' | 'BOX' | 'MOVE' | 'PAN' | 'MEASURE';
  type DragState = { type: DragType, sx: number, sy: number, ex: number, ey: number } | null;
  const [drag, _setDrag] = useState<DragState>(null);
  // Mirror into a ref so handlers always see the latest value without stale closures
  const dragRef      = useRef<DragState>(null);
  const setDrag      = (v: DragState) => { dragRef.current = v; _setDrag(v); };
  const moveStartRef = useRef<Record<string, { x: number, y: number }>>({});
  const panStartRef  = useRef<{ cx: number, cy: number, px: number, py: number } | null>(null);
  // Tracks whether a real drag just finished — prevents onClick from deselecting after a BOX select
  const wasDragRef   = useRef(false);

  // ── Coords: mouse → image fraction (0–1), works at any zoom ──
  const rel = (e: React.MouseEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  // ── Fit image when first loaded ───────────────────────────────
  const onImageLoad = () => {
    const img = imgRef.current, con = containerRef.current;
    if (!img || !con) return;
    const scale = Math.min(con.clientWidth / img.naturalWidth, con.clientHeight / img.naturalHeight, 1);
    setVpZoom(scale);
    setVpPan({ x: (con.clientWidth - img.naturalWidth * scale) / 2, y: (con.clientHeight - img.naturalHeight * scale) / 2 });
  };

  // ── Scroll-wheel zoom toward cursor ───────────────────────────
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor  = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.max(0.1, Math.min(20, vpZoom * factor));
    const con     = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - con.left, my = e.clientY - con.top;
    const img = imgRef.current!;
    const fx = (mx - vpPan.x) / (img.naturalWidth  * vpZoom);
    const fy = (my - vpPan.y) / (img.naturalHeight * vpZoom);
    setVpZoom(newZoom);
    setVpPan({ x: mx - fx * img.naturalWidth * newZoom, y: my - fy * img.naturalHeight * newZoom });
  };

  // ── Mouse down ────────────────────────────────────────────────
  const onDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (calMode !== 'idle') return;
    if ((e.target as HTMLElement).dataset.marker) return;
    wasDragRef.current = false;
    const pos = rel(e);
    if (isDKeyPressed) {
      setDrag({ type: 'MEASURE', sx: pos.x, sy: pos.y, ex: pos.x, ey: pos.y });
      return;
    }
    const isPlace = e.metaKey || e.ctrlKey;
    if (!isPlace) {
      if (e.shiftKey) {
        setDrag({ type: 'BOX', sx: pos.x, sy: pos.y, ex: pos.x, ey: pos.y });
      } else if (selectedIds.length > 0) {
        moveStartRef.current = {};
        items.filter((i: BlueprintItem) => selectedIds.includes(i.instanceId))
          .forEach((i: BlueprintItem) => { moveStartRef.current[i.instanceId] = { x: i.x, y: i.y }; });
        setDrag({ type: 'MOVE', sx: pos.x, sy: pos.y, ex: pos.x, ey: pos.y });
      } else {
        panStartRef.current = { cx: e.clientX, cy: e.clientY, px: vpPan.x, py: vpPan.y };
        setDrag({ type: 'PAN', sx: 0, sy: 0, ex: 0, ey: 0 });
      }
      return;
    }
    setDrag({ type: 'PATH', sx: pos.x, sy: pos.y, ex: pos.x, ey: pos.y });
  };

  // ── Click ─────────────────────────────────────────────────────
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // After a real drag (BOX select, MOVE, PAN), the browser fires click on mouseup.
    // Ignore it so we don't immediately undo what onUp just did.
    if (wasDragRef.current) { wasDragRef.current = false; return; }
    if (calMode !== 'idle') {
      if ((e.target as HTMLElement).dataset.marker) return;
      onCalClick(rel(e));
      return;
    }
    if (!(e.metaKey || e.ctrlKey) && !(e.target as HTMLElement).dataset.marker) setSelectedIds([]);
  };

  // ── Mouse move ────────────────────────────────────────────────
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const d = dragRef.current;          // always current, no stale closure
    if (!d) return;
    if (d.type === 'PAN') {
      if (!panStartRef.current) return;
      setVpPan({ x: panStartRef.current.px + (e.clientX - panStartRef.current.cx), y: panStartRef.current.py + (e.clientY - panStartRef.current.cy) });
      return;
    }
    const pos = rel(e);
    setDrag({ ...d, ex: pos.x, ey: pos.y });
    if (d.type === 'MOVE') {
      const dx = pos.x - d.sx, dy = pos.y - d.sy;
      setItems((prev: BlueprintItem[]) => prev.map((item: BlueprintItem) => {
        const o = moveStartRef.current[item.instanceId];
        return o ? { ...item, x: o.x + dx, y: o.y + dy } : item;
      }));
    }
  };

  // ── Mouse up ──────────────────────────────────────────────────
  const onUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (calMode !== 'idle') return;
    const d = dragRef.current;          // always current, no stale closure
    if (!d) return;
    if (d.type === 'MOVE' || d.type === 'PAN') { panStartRef.current = null; setDrag(null); return; }
    if (d.type === 'MEASURE') {
      const end = rel(e);
      setMeasureBpPts([{ x: d.sx, y: d.sy }, { x: end.x, y: end.y }]);
      wasDragRef.current = true;
      setDrag(null);
      return;
    }

    // Recompute end from the actual mouseup coordinates
    const end  = rel(e);
    const img  = imgRef.current!;
    const dxPx = (end.x - d.sx) * img.clientWidth  * vpZoom;
    const dyPx = (end.y - d.sy) * img.clientHeight * vpZoom;
    const dist = Math.sqrt(dxPx * dxPx + dyPx * dyPx);

    if (d.type === 'PATH') {
      const product = PRODUCTS.find(p => p.id === selectedProductId) || PRODUCTS[0];

      // ── Snap helpers ────────────────────────────────────────────
      const SNAP_PX = 24;
      // Returns the raw endpoint position of the nearest barrier (fraction coords)
      const findBpEndpoint = (frac: {x:number,y:number}) => {
        const img = imgRef.current; if (!img || bpScale <= 0) return null;
        let best: {x:number,y:number,rotation:number,dist:number}|null = null;
        for (const item of items) {
          const prod = PRODUCTS.find(p => p.id === item.productId); if (!prod) continue;
          const θ = item.rotation * Math.PI / 180;
          const halfFracX = (prod.length * bpScale / img.naturalWidth) / 2;
          const halfFracY = (prod.length * bpScale / img.naturalHeight) / 2;
          for (const dir of [1,-1] as const) {
            const epx = item.x + dir * Math.cos(θ) * halfFracX;
            const epy = item.y + dir * Math.sin(θ) * halfFracY;
            const dScreen = Math.hypot((epx - frac.x) * img.clientWidth * vpZoom, (epy - frac.y) * img.clientHeight * vpZoom);
            if (dScreen < SNAP_PX && (!best || dScreen < best.dist))
              best = { x: epx, y: epy, rotation: item.rotation, dist: dScreen };
          }
        }
        return best;
      };
      // Returns the snapped center for a single-click placement
      const findBpSnap = (frac: {x:number,y:number}) => {
        const ep = findBpEndpoint(frac); if (!ep) return null;
        const img = imgRef.current!;
        const θ = ep.rotation * Math.PI / 180;
        const newHalfFracX = (product.length * bpScale / img.naturalWidth) / 2;
        const newHalfFracY = (product.length * bpScale / img.naturalHeight) / 2;
        const dot = Math.cos(θ) * (frac.x - ep.x) + Math.sin(θ) * (frac.y - ep.y);
        const dir = dot >= 0 ? 1 : -1;
        return {
          x: ep.x + dir * Math.cos(θ) * newHalfFracX,
          y: ep.y + dir * Math.sin(θ) * newHalfFracY,
          rotation: ep.rotation,
        };
      };

      if (dist < 8) {
        const snap = findBpSnap({ x: d.sx, y: d.sy });
        const item: BlueprintItem = snap
          ? { instanceId: Math.random().toString(36).substr(2, 9), productId: product.id, x: snap.x, y: snap.y, rotation: snap.rotation }
          : { instanceId: Math.random().toString(36).substr(2, 9), productId: product.id, x: d.sx, y: d.sy, rotation: 0 };
        setItems((prev: BlueprintItem[]) => [...prev, item]);
        setSelectedIds([item.instanceId]);
      } else {
        const ep = findBpEndpoint({ x: d.sx, y: d.sy });
        const sx = ep ? ep.x : d.sx;
        const sy = ep ? ep.y : d.sy;
        const img2 = imgRef.current!;
        const ndxNat = (end.x - sx) * img2.naturalWidth;
        const ndyNat = (end.y - sy) * img2.naturalHeight;
        const ndist = Math.hypot(ndxNat, ndyNat);
        const heading = Math.atan2(ndyNat, ndxNat) * 180 / Math.PI;
        const productLenPx = product.length * bpScale;
        const count = Math.max(1, Math.floor(ndist / productLenPx));
        setItems((prev: BlueprintItem[]) => [...prev, ...Array.from({ length: count }, (_, i) => {
          const frac = (productLenPx / 2 + i * productLenPx) / ndist;
          return {
            instanceId: Math.random().toString(36).substr(2, 9),
            productId:  product.id,
            x: sx + (end.x - sx) * frac,
            y: sy + (end.y - sy) * frac,
            rotation: heading,
          };
        })]);
      }
    } else {
      // BOX select
      const [minX, maxX] = [Math.min(d.sx, end.x), Math.max(d.sx, end.x)];
      const [minY, maxY] = [Math.min(d.sy, end.y), Math.max(d.sy, end.y)];
      setSelectedIds(items.filter((i: BlueprintItem) => i.x >= minX && i.x <= maxX && i.y >= minY && i.y <= maxY).map((i: BlueprintItem) => i.instanceId));
    }
    wasDragRef.current = true;  // tell onClick to skip its deselect
    setDrag(null);
  };

  // ── Calibration overlay (SVG on image) ───────────────────────
  const CalibrationOverlay = () => {
    if (calMode === 'idle' || calPts.length === 0) return null;
    const ARM = 12, a = calPts[0], b = calPts[1];
    const cross = (pt: { x: number; y: number }, label: string) => (
      <g key={label}>
        <line x1={`calc(${pt.x*100}% - ${ARM}px)`} y1={`${pt.y*100}%`} x2={`calc(${pt.x*100}% + ${ARM}px)`} y2={`${pt.y*100}%`} stroke="#f97316" strokeWidth="2" />
        <line x1={`${pt.x*100}%`} y1={`calc(${pt.y*100}% - ${ARM}px)`} x2={`${pt.x*100}%`} y2={`calc(${pt.y*100}% + ${ARM}px)`} stroke="#f97316" strokeWidth="2" />
        <circle cx={`${pt.x*100}%`} cy={`${pt.y*100}%`} r="2" fill="white" />
        <text x={`calc(${pt.x*100}% + ${ARM+4}px)`} y={`calc(${pt.y*100}% - 4px)`} fill="#f97316" fontSize="10" fontWeight="bold" fontFamily="monospace">{label}</text>
      </g>
    );
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 20 }}>
        {b && <line x1={`${a.x*100}%`} y1={`${a.y*100}%`} x2={`${b.x*100}%`} y2={`${b.y*100}%`} stroke="#f97316" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7" />}
        {cross(a, 'A')}{b && cross(b, 'B')}
      </svg>
    );
  };

  // ── Calibration input (floats at line midpoint) ───────────────
  const CalibrationInput = () => {
    if (calMode !== 'confirm' || calPts.length < 2) return null;
    const a = calPts[0], b = calPts[1];
    const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    const confirm = () => {
      const ft  = parseInt((document.getElementById('cal-ft') as HTMLInputElement)?.value || '0') || 0;
      const ins = parseFloat((document.getElementById('cal-in') as HTMLInputElement)?.value || '0') || 0;
      const tot = ft + ins / 12;
      if (tot > 0) onCalClick({ confirm: true, value: String(tot) });
    };
    return (
      <div className="absolute z-30 pointer-events-auto" style={{ left: `${midX*100}%`, top: `${midY*100}%`, transform: `translate(-50%, -140%) scale(${1/vpZoom})`, transformOrigin: 'center bottom' }}>
        <div className="bg-slate-900/95 backdrop-blur border border-orange-500/60 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2 whitespace-nowrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">A → B =</span>
          <input id="cal-ft" type="number" min="0" step="1" placeholder="0" autoFocus className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-sm text-orange-400 font-mono outline-none focus:border-orange-500 text-center" onKeyDown={e => { if (e.key==='Enter') confirm(); if (e.key==='Escape') onCalClick({cancel:true}); }} />
          <span className="text-[10px] font-bold text-slate-500">ft</span>
          <input id="cal-in" type="number" min="0" max="11" step="1" placeholder="0" className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-sm text-orange-400 font-mono outline-none focus:border-orange-500 text-center" onKeyDown={e => { if (e.key==='Enter') confirm(); if (e.key==='Escape') onCalClick({cancel:true}); }} />
          <span className="text-[10px] font-bold text-slate-500">in</span>
          <button className="ml-1 px-3 py-1 bg-orange-600 hover:bg-orange-500 text-slate-950 rounded-lg text-[10px] font-black uppercase" onClick={confirm}>✓</button>
          <button className="px-2 py-1 text-slate-500 hover:text-red-400 text-[10px] font-bold" onClick={() => onCalClick({cancel:true})}>✕</button>
        </div>
        <div className="w-0.5 h-4 bg-orange-500/60 mx-auto" />
      </div>
    );
  };

  // ── Cursor ────────────────────────────────────────────────────
  const cursor =
    calMode !== 'idle'              ? 'cursor-crosshair'  :
    isDKeyPressed                   ? 'cursor-crosshair'  :
    drag?.type === 'PAN'           ? 'cursor-grabbing'   :
    selectedIds.length === 0        ? 'cursor-grab'  :
                                     'cursor-move';

  // ── Blueprint measure overlay ─────────────────────────────────
  const MeasureOverlay = () => {
    if (!measureBpPts || measureBpPts.length === 0) return null;
    const a = measureBpPts[0], b = measureBpPts[1];
    const img = imgRef.current;
    const distLabel = (() => {
      if (!b || !img) return null;
      const dxPx = (b.x - a.x) * img.clientWidth;
      const dyPx = (b.y - a.y) * img.clientHeight;
      return formatDist(Math.sqrt(dxPx*dxPx + dyPx*dyPx) / bpScale);
    })();
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 25 }}>
        {b && <line x1={`${a.x*100}%`} y1={`${a.y*100}%`} x2={`${b.x*100}%`} y2={`${b.y*100}%`} stroke="#f97316" strokeWidth="1.5" strokeDasharray="8 4" />}
        <circle cx={`${a.x*100}%`} cy={`${a.y*100}%`} r="5" fill="#f97316" />
        {b && <circle cx={`${b.x*100}%`} cy={`${b.y*100}%`} r="5" fill="#f97316" />}
        {b && distLabel && (() => {
          const mx = (a.x+b.x)/2*100, my = (a.y+b.y)/2*100;
          return (
            <>
              <rect x={`calc(${mx}% - 34px)`} y={`calc(${my}% - 22px)`} width="68" height="18" rx="4" fill="#0f172a" stroke="#f97316" strokeWidth="1" />
              <text x={`${mx}%`} y={`calc(${my}% - 9px)`} fill="#fb923c" fontSize="10" fontWeight="700" fontFamily="monospace" textAnchor="middle">{distLabel}</text>
            </>
          );
        })()}
      </svg>
    );
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden bg-slate-950 relative ${cursor}`}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onClick={onClick} onWheel={onWheel}
      style={{ userSelect: 'none' }}
    >
      {/* Zoom/pan viewport */}
      <div style={{ position: 'absolute', transform: `translate(${vpPan.x}px, ${vpPan.y}px) scale(${vpZoom})`, transformOrigin: '0 0' }}>
        <div className="relative" style={{ lineHeight: 0 }}>
          <img ref={imgRef} src={blueprintUrl} alt="Blueprint" draggable={false} onLoad={onImageLoad} style={{ display: 'block', maxWidth: 'none' }} />

          {/* Instruction banner (counter-scaled so it stays readable) */}
          {calMode !== 'idle' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <div className="bg-orange-600/90 backdrop-blur text-slate-950 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl" style={{ transform: `scale(${1/vpZoom})`, transformOrigin: 'center top' }}>
                {calMode === 'picking' && calPts.length === 0 && '① Click Point A on the blueprint'}
                {calMode === 'picking' && calPts.length === 1 && '② Click Point B on the blueprint'}
                {calMode === 'confirm' && 'Enter the real-world distance between the two points'}
              </div>
            </div>
          )}

          <CalibrationOverlay />
          <CalibrationInput />
          <MeasureOverlay />

          {drag && drag.type === 'BOX' && (
            <div className="absolute pointer-events-none border-2 bg-blue-500/20 border-blue-500"
              style={{ left: `${Math.min(drag.sx,drag.ex)*100}%`, top: `${Math.min(drag.sy,drag.ey)*100}%`, width: `${Math.abs(drag.ex-drag.sx)*100}%`, height: `${Math.abs(drag.ey-drag.sy)*100}%` }} />
          )}
          {drag && drag.type === 'PATH' && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 15 }}>
              <line x1={`${drag.sx*100}%`} y1={`${drag.sy*100}%`} x2={`${drag.ex*100}%`} y2={`${drag.ey*100}%`} stroke="#f97316" strokeWidth="2" strokeDasharray="8 4" />
              <circle cx={`${drag.sx*100}%`} cy={`${drag.sy*100}%`} r="4" fill="#f97316" />
              <circle cx={`${drag.ex*100}%`} cy={`${drag.ey*100}%`} r="4" fill="#f97316" />
            </svg>
          )}
          {drag && drag.type === 'MEASURE' && (() => {
            const img = imgRef.current;
            const distLabel = img && bpScale > 0 ? (() => {
              const dxPx = (drag.ex - drag.sx) * img.clientWidth;
              const dyPx = (drag.ey - drag.sy) * img.clientHeight;
              return formatDist(Math.sqrt(dxPx*dxPx + dyPx*dyPx) / bpScale);
            })() : null;
            const mx = (drag.sx + drag.ex) / 2 * 100;
            const my = (drag.sy + drag.ey) / 2 * 100;
            return (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 26 }}>
                <line x1={`${drag.sx*100}%`} y1={`${drag.sy*100}%`} x2={`${drag.ex*100}%`} y2={`${drag.ey*100}%`} stroke="#10b981" strokeWidth="2" strokeDasharray="8 4" />
                <circle cx={`${drag.sx*100}%`} cy={`${drag.sy*100}%`} r="5" fill="#10b981" />
                <circle cx={`${drag.ex*100}%`} cy={`${drag.ey*100}%`} r="5" fill="#10b981" />
                {distLabel && (
                  <>
                    <rect x={`calc(${mx}% - 34px)`} y={`calc(${my}% - 22px)`} width="68" height="18" rx="4" fill="#0f172a" stroke="#10b981" strokeWidth="1" />
                    <text x={`${mx}%`} y={`calc(${my}% - 9px)`} fill="#34d399" fontSize="10" fontWeight="700" fontFamily="monospace" textAnchor="middle">{distLabel}</text>
                  </>
                )}
              </svg>
            );
          })()}

          {items.map((item: BlueprintItem) => {
            const product = PRODUCTS.find(p => p.id === item.productId);
            if (!product) return null;
            const isSelected = selectedIds.includes(item.instanceId);
            return (
              <div key={item.instanceId} data-marker="1"
                style={{ position: 'absolute', left: `${item.x*100}%`, top: `${item.y*100}%`, width: product.length * bpScale, height: product.width * bpScale, transform: `translate(-50%,-50%) rotate(${item.rotation}deg)`, zIndex: isSelected ? 10 : 5 }}
                className={`rounded-sm border flex items-center justify-center ${isSelected ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-slate-500'} bg-slate-900/70`}
                onClick={e => {
                  e.stopPropagation();
                  if (calMode !== 'idle') return;
                  if (!(e.metaKey || e.ctrlKey)) {
                    const isMulti = e.shiftKey;
                    setSelectedIds((prev: string[]) => isMulti
                      ? (prev.includes(item.instanceId) ? prev.filter(i => i !== item.instanceId) : [...prev, item.instanceId])
                      : [item.instanceId]);
                  }
                }}
              >
                <div className={`absolute inset-0 ${product.color} opacity-40 rounded-sm`} />
                <span className="relative text-[5px] font-black text-white uppercase text-center z-10 px-0.5 leading-none">{product.name.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function SitePlanner() {
  const [mounted, setMounted] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDKeyPressed, setIsDKeyPressed] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedProductId, setSelectedProductId] = useState<string>(PRODUCTS[0].id);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [blueprintItems, setBlueprintItems] = useState<BlueprintItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [interaction, setInteraction] = useState<{type: 'BOX' | 'PATH', start: {x: number, y: number}, end: {x: number, y: number}} | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'blueprint'>('map');
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(null);
  const [bpScale, setBpScale] = useState<number>(8);
  const [calMode, setCalMode] = useState<'idle' | 'picking' | 'confirm'>('idle');
  const [calPts, setCalPts] = useState<{x: number, y: number}[]>([]);
  // Tape measure state (separate for each view)
  const [measureMapPts, setMeasureMapPts] = useState<{lat:number,lng:number}[]>([]);
  const [measureBpPts,  setMeasureBpPts]  = useState<{x:number,y:number}[]>([]);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  // Stores the raw blueprint File so we can persist it to IndexedDB on save
  const blueprintBlobRef = useRef<Blob | null>(null);
  // True only after a NEW blueprint is loaded and not yet written to IndexedDB
  const blobNeedsSave    = useRef(false);
  // Prevents auto-save from firing empty state while a plan restore is in flight
  const isRestoring      = useRef(false);
  const externalCameraUpdateRef = useRef<number>(0);

  // ── Undo history ─────────────────────────────────────────────────────────
  type HistorySnapshot = { placedItems: PlacedItem[]; blueprintItems: BlueprintItem[] };
  const historyStack    = useRef<HistorySnapshot[]>([]);
  const applyingHistory = useRef(false);
  const prevItemsRef    = useRef<HistorySnapshot>({ placedItems: [], blueprintItems: [] });
  const historyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('satellite');
  const [mapCenter, setMapCenter] = useState({ lat: 39.04, lng: -77.48 });
  const [zoom, setZoom] = useState(19);
  const [pixelsPerFoot, setPixelsPerFoot] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const lastDragPos = useRef<{lat: number, lng: number} | null>(null);

  // ── Plans ────────────────────────────────────────────────────────────────
  const {
    plans, activePlanId, activePlanName, setActivePlanName,
    saveCurrentPlan, loadPlan, newPlan, deletePlan,
  } = usePlans();
  const [isPlansOpen, setIsPlansOpen] = useState(false);

  // Build the serializable state snapshot used for saving
  const getPlanState = useCallback(() => ({
    placedItems,
    blueprintItems,
    mapCenter,
    zoom,
    mapType,
    viewMode,
    bpScale,
    selectedProductId,
    hasBlueprintImage: blueprintUrl !== null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [placedItems, blueprintItems, mapCenter, zoom, mapType, viewMode, bpScale, selectedProductId, blueprintUrl]);

  // Expose a manual save (used by PlansDrawer's Save button)
  const handleManualSave = useCallback(async (name: string) => {
    await saveCurrentPlan(
      getPlanState(),
      name,
      blobNeedsSave.current ? blueprintBlobRef.current : null,
    );
    blobNeedsSave.current = false;
  }, [saveCurrentPlan, getPlanState]);

  // Apply a loaded plan to all local state
  const handleLoadPlan = useCallback(async (id: string) => {
    const { plan, blueprintUrl: newBpUrl } = await loadPlan(id);
    // Revoke previous blob URL to free memory
    if (blueprintUrl) URL.revokeObjectURL(blueprintUrl);
    blueprintBlobRef.current = null;
    blobNeedsSave.current    = false;
    // Clear undo history — undo across plan boundaries doesn't make sense
    historyStack.current = [];
    applyingHistory.current = true;
    setCanUndo(false);
    setPlacedItems(plan.placedItems);
    setBlueprintItems(plan.blueprintItems);
    setMapCenter(plan.mapCenter);
    setZoom(plan.zoom);
    externalCameraUpdateRef.current = Date.now();
    setMapType(plan.mapType);
    setViewMode(plan.viewMode);
    setBpScale(plan.bpScale);
    setSelectedProductId(plan.selectedProductId);
    setBlueprintUrl(newBpUrl);
    setSelectedIds([]);
    setCalMode('idle');
    setCalPts([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPlan, blueprintUrl]);

  // Pop the latest history snapshot and restore it
  const handleUndo = useCallback(() => {
    if (historyStack.current.length === 0) return;
    const snapshot = historyStack.current[historyStack.current.length - 1];
    historyStack.current = historyStack.current.slice(0, -1);
    applyingHistory.current = true;
    setPlacedItems(snapshot.placedItems);
    setBlueprintItems(snapshot.blueprintItems);
    setSelectedIds([]);
    setCanUndo(historyStack.current.length > 0);
  }, []);

  // ── Calibration handler ─────────────────────────────────────
  const onCalClick = (payload: any) => {
    if (payload.cancel) {
      setCalMode('idle'); setCalPts([]);
      return;
    }
    if (payload.confirm) {
      const feet = parseFloat(payload.value);
      if (isNaN(feet) || feet <= 0 || !calPts[1]) return;
      // Calculate pixel distance between the two calibration points.
      // calPts are stored as fractions (0-1). We need the rendered image size.
      const img = document.querySelector('img[alt="Blueprint"]') as HTMLImageElement;
      if (!img) return;
      const dxPx = (calPts[1].x - calPts[0].x) * img.clientWidth;
      const dyPx = (calPts[1].y - calPts[0].y) * img.clientHeight;
      const distPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
      setBpScale(distPx / feet);
      setCalMode('idle'); setCalPts([]);
      return;
    }
    // Normal point placement
    if (calMode === 'picking') {
      const next = [...calPts, payload];
      setCalPts(next);
      if (next.length === 2) setCalMode('confirm');
    }
  };

  useEffect(() => { setMounted(true); }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIds([]);
      if (e.key === 'd' || e.key === 'D') setIsDKeyPressed(true);
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setIsDKeyPressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleUndo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const metersPerPixel = 156543.03392 * Math.cos(mapCenter.lat * Math.PI / 180) / Math.pow(2, zoom);
    setPixelsPerFoot(1 / (metersPerPixel * 3.28084));
  }, [zoom, mapCenter.lat]);

  // ── Restore active plan on initial page load ─────────────────────────────
  useEffect(() => {
    if (!mounted || !activePlanId) return;
    isRestoring.current = true;
    handleLoadPlan(activePlanId).finally(() => {
      isRestoring.current = false;
    });
  // Only run once after mount — activePlanId is stable from localStorage
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ── History tracking (debounced 400 ms) ─────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    // When an undo is being applied, sync prevItemsRef to restored state and bail
    if (applyingHistory.current) {
      applyingHistory.current = false;
      prevItemsRef.current = { placedItems: [...placedItems], blueprintItems: [...blueprintItems] };
      return;
    }
    // When a plan is being restored, skip recording
    if (isRestoring.current) return;
    if (historyDebounce.current) clearTimeout(historyDebounce.current);
    // Capture the PREVIOUS committed state now (before the debounce fires)
    const snapshot: HistorySnapshot = {
      placedItems:    [...prevItemsRef.current.placedItems],
      blueprintItems: [...prevItemsRef.current.blueprintItems],
    };
    historyDebounce.current = setTimeout(() => {
      historyStack.current = [...historyStack.current.slice(-49), snapshot];
      prevItemsRef.current = { placedItems: [...placedItems], blueprintItems: [...blueprintItems] };
      setCanUndo(historyStack.current.length > 0);
    }, 400);
    return () => { if (historyDebounce.current) clearTimeout(historyDebounce.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedItems, blueprintItems, mounted]);

  // ── Auto-save (debounced 600 ms) ────────────────────────────────────────
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!mounted || isRestoring.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (isRestoring.current) return; // double-guard for async restore
      await saveCurrentPlan(
        getPlanState(),
        undefined,
        blobNeedsSave.current ? blueprintBlobRef.current : null,
      );
      blobNeedsSave.current = false;
    }, 600);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedItems, blueprintItems, mapCenter, zoom, mapType, viewMode, bpScale, selectedProductId, blueprintUrl, mounted]);

  const handleExport = useCallback(async () => {
    await exportPlan({
      planName: activePlanName,
      placedItems: viewMode === 'map' ? placedItems : [],
      blueprintItems: viewMode === 'blueprint' ? blueprintItems : [],
      products: PRODUCTS,
      viewMode,
      mapCenter,
      zoom,
      mapType,
      blueprintUrl,
      bpScale,
      apiKey: GOOGLE_MAPS_API_KEY,
    });
  }, [activePlanName, placedItems, blueprintItems, viewMode, mapCenter, zoom, mapType, blueprintUrl, bpScale]);

  if (!mounted) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-mono text-xs uppercase tracking-widest">Initializing Site Planner...</div>;

  const deleteSelected = () => {
    setPlacedItems(prev => prev.filter(item => !selectedIds.includes(item.instanceId)));
    setBlueprintItems(prev => prev.filter(item => !selectedIds.includes(item.instanceId)));
    setSelectedIds([]);
  };

  const updateItems = (ids: string[], updates: Partial<PlacedItem>) => {
    setPlacedItems(prev => prev.map(item => ids.includes(item.instanceId) ? { ...item, ...updates } : item));
    setBlueprintItems(prev => prev.map(item => ids.includes(item.instanceId) ? { ...item, ...updates } : item));
  };

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: searchQuery }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const loc = results[0].geometry.location;
          setMapCenter({ lat: loc.lat(), lng: loc.lng() });
        }
      });
    }
  };

  const activeItems = viewMode === 'map' ? placedItems : blueprintItems;
  const totalEstimate = activeItems.reduce((acc, item) => {
    const product = PRODUCTS.find(p => p.id === item.productId);
    return acc + (product?.price || 0);
  }, 0);

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <main className="h-screen bg-slate-950 text-slate-50 flex overflow-hidden font-sans select-none">
        {/* Sidebar */}
        {/* ── SIDEBAR: 3 locked zones, no page scroll ── */}
        <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-2xl h-full">


          {/* ZONE 1 — Header + Mode toggle (fixed height) */}
          <div className="flex-none px-5 pt-4 pb-4 border-b border-slate-800/60">

            {/* Brand row: logo + title */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-3">
                <img
                  src="/valtir-logo.png"
                  alt="Valtir"
                  className="h-9 w-auto object-contain flex-none"
                />
                <h1 className="text-2xl font-black tracking-tight text-slate-100 uppercase leading-none mt-1">Site Planner</h1>
              </div>
              <button 
                onClick={() => setIsSearchOpen(prev => !prev)}
                className={`p-2 rounded-lg transition-colors mt-1.5 ${isSearchOpen ? 'bg-orange-500/10 text-orange-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
              >
                <SearchIcon className="w-4 h-4" />
              </button>
            </div>

            {/* "Powered by Metamend" */}
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-6">
              Powered by <span className="text-slate-500 font-black">Metamend</span>
            </p>

            {/* Active plan name — prominent (unchanged) */}
            <button
              onClick={() => setIsPlansOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-orange-500/40 hover:bg-slate-950/80 transition-all group mb-4"
            >
              <FolderOpen className="w-3.5 h-3.5 text-slate-500 group-hover:text-orange-400 flex-none transition-colors" />
              <span className="flex-1 text-left text-xs font-bold text-slate-200 group-hover:text-orange-400 truncate transition-colors">{activePlanName}</span>
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest flex-none group-hover:text-orange-500 transition-colors">Plans</span>
            </button>

            {/* Mode Selector Removed */}
          </div>

          {/* ZONE 2 — Category filter + scrollable product list (grows to fill remaining space) */}
          <div className="flex-1 flex flex-col min-h-0 px-4 pt-4">
            {/* Category pills — pinned at top of zone 2 */}
            <div className="flex-none flex gap-2 overflow-x-auto mb-3 pb-1" style={{ scrollbarWidth: 'none' }}>
              {['All', 'Water', 'Steel'].map((label) => {
                const cat = label === 'Water' ? 'Water Barrier' : label === 'Steel' ? 'Steel Barrier' : label;
                return (
                  <button
                    key={label}
                    onClick={() => setActiveCategory(cat)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                      activeCategory === cat
                        ? 'bg-orange-600 border-orange-500 text-slate-950'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Product list — the ONLY scroll container in the sidebar */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
              {PRODUCTS.filter(p => activeCategory === 'All' || p.category === activeCategory).map((product) => (
                <div
                  key={product.id}
                  onClick={() => setSelectedProductId(product.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    selectedProductId === product.id
                      ? 'bg-orange-500/10 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.08)]'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Product thumbnail */}
                  <div className="flex-none w-16 h-12 rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover object-center"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-xs leading-tight truncate ${
                      selectedProductId === product.id ? 'text-orange-500' : 'text-slate-200'
                    }`}>
                      {product.name}
                    </h3>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider truncate">{product.category}</p>
                      <span className="text-[9px] font-mono text-slate-400 flex-none ml-2">{product.length} ft</span>
                    </div>
                  </div>

                  {/* Active indicator */}
                  {selectedProductId === product.id && (
                    <div className="flex-none w-1.5 h-1.5 rounded-full bg-orange-500" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ZONE 3 — Breakdown + Rotation + Estimate + Quote (always visible, pinned to bottom) */}
          <div className="flex-none border-t border-slate-800/60 p-4 flex flex-col gap-3">
            {/* Barrier breakdown list */}
            {(() => {
              const allItems = viewMode === 'map' ? placedItems : blueprintItems;
              if (allItems.length === 0) return null;
              // Count + cost per product
              const breakdown = PRODUCTS
                .map(p => ({ product: p, count: allItems.filter(i => i.productId === p.id).length }))
                .filter(({ count }) => count > 0);
              return (
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Barrier Breakdown</p>
                  <div className="overflow-y-auto flex flex-col gap-1" style={{ maxHeight: '112px', scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
                    {breakdown.map(({ product, count }) => (
                      <div key={product.id} className="flex items-center gap-2">
                        <div className={`flex-none w-1.5 h-5 rounded-sm ${product.color} opacity-70`} />
                        <span className="flex-1 text-[10px] text-slate-300 font-medium truncate">{product.name}</span>
                        <span className="flex-none text-[9px] font-bold text-slate-500 tabular-nums">{count}×</span>
                        <span className="flex-none text-[9px] font-mono text-orange-400 tabular-nums w-14 text-right">${(count * product.price).toLocaleString()}/day</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Estimate + Quote */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Est. Daily Cost</span>
                <span className="text-[10px] font-bold text-orange-500">{viewMode === 'map' ? placedItems.length : blueprintItems.length} units</span>
              </div>
              <div className="text-2xl font-black mb-3">${totalEstimate.toLocaleString()}<span className="text-xs text-slate-600 font-normal ml-2">/day</span></div>
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700 bg-slate-900 hover:border-orange-500/50 hover:text-orange-400 text-slate-400 text-[10px] font-black uppercase tracking-widest transition-all"
                  title="Export as image"
                >
                  <ImageDown className="w-4 h-4" /> Export
                </button>
                <button className="flex-none px-4 py-3 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-slate-950 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl transition-colors whitespace-nowrap">
                  Get Quote
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Map Area */}
        <section className="flex-1 relative">
          {/* Controls */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10 pointer-events-none">
            {isSearchOpen ? (
              <div className="flex-1 max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-2xl pointer-events-auto">
                <SearchIcon className="w-4 h-4 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Job site address..." 
                  className="bg-transparent border-none outline-none text-sm text-slate-200 w-full placeholder:text-slate-600"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                />
                <button 
                  onClick={() => setIsSearchOpen(false)}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* Right controls panel */}
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl pointer-events-auto">
              {/* Plans + Undo row */}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPlansOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-700 bg-slate-950 hover:border-orange-500/50 hover:text-orange-400 text-slate-400 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Plans
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear everything and start over?')) {
                      newPlan();
                      setPlacedItems([]);
                      setBlueprintItems([]);
                      setSelectedIds([]);
                      setBlueprintUrl(null);
                      setCalMode('idle');
                      historyStack.current = [];
                      setCanUndo(false);
                      setViewMode('map');
                    }
                  }}
                  title="Start Over"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-400 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                  </svg>
                  Restart
                </button>
              </div>
              <div className="flex bg-slate-950 p-1 rounded-xl">
                <button onClick={() => setViewMode('map')} className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${viewMode === 'map' ? 'bg-orange-600 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}>🗺 Map</button>
                <button onClick={() => { setViewMode('blueprint'); if (!blueprintUrl) fileInputRef.current?.click(); }} className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${viewMode === 'blueprint' ? 'bg-orange-600 text-slate-950' : 'text-slate-500 hover:text-slate-300'}`}>📐 Blueprint</button>
              </div>
              {viewMode === 'map' && (
                <>
                  <div className="flex bg-slate-950 rounded-xl border border-slate-800 p-0.5 gap-0.5">
                    <button
                      onClick={() => setMapType('roadmap')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-150 ${mapType === 'roadmap' ? 'bg-slate-700 text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <span className="text-[11px]">🗺</span> Map
                    </button>
                    <div className="w-px bg-slate-800 my-1" />
                    <button
                      onClick={() => setMapType('satellite')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-150 ${mapType === 'satellite' ? 'bg-slate-700 text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <span className="text-[11px]">🛰</span> Satellite
                    </button>
                  </div>
                </>
              )}
              {viewMode === 'blueprint' && blueprintUrl && (
                <>
                  <button
                    onClick={() => { setCalMode('picking'); setCalPts([]); }}
                    className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      calMode !== 'idle'
                        ? 'bg-orange-600 border-orange-500 text-slate-950'
                        : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-orange-500/50'
                    }`}
                  >
                    {calMode !== 'idle' ? '⊙ Calibrating...' : '📏 Calibrate Scale'}
                  </button>
                  {calMode !== 'idle' && (
                    <button onClick={() => { setCalMode('idle'); setCalPts([]); }} className="text-[9px] font-bold text-slate-500 hover:text-red-400 uppercase tracking-widest">✕ Cancel</button>
                  )}
                  <div className="flex justify-between text-[9px] font-bold text-slate-600 uppercase">
                    <span>Current Scale</span>
                    <span className="text-slate-400 font-mono">{bpScale.toFixed(1)} px/ft</span>
                  </div>
                  <button onClick={() => { setBlueprintUrl(null); setBlueprintItems([]); setViewMode('map'); setCalMode('idle'); setCalPts([]); }} className="text-[9px] font-bold text-red-500/70 hover:text-red-500 uppercase tracking-widest">✕ Remove Blueprint</button>
                </>
              )}
            </div>
          </div>


          {/* hidden file input for blueprint upload */}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const file = e.target.files?.[0];
            if (file) {
              // Revoke old URL to avoid memory leaks
              if (blueprintUrl) URL.revokeObjectURL(blueprintUrl);
              const url = URL.createObjectURL(file);
              setBlueprintUrl(url);
              setViewMode('blueprint');
              // Cache the blob for IndexedDB persistence on next save
              blueprintBlobRef.current = file;
              blobNeedsSave.current    = true;
            }
          }} />

          {viewMode === 'blueprint' ? (
            blueprintUrl ? (
              <BlueprintCanvas
                blueprintUrl={blueprintUrl}
                items={blueprintItems} setItems={setBlueprintItems}
                selectedIds={selectedIds} setSelectedIds={setSelectedIds}
                isDKeyPressed={isDKeyPressed} selectedProductId={selectedProductId}
                bpScale={bpScale}
                calMode={calMode} calPts={calPts} onCalClick={onCalClick}
                measureBpPts={measureBpPts} setMeasureBpPts={setMeasureBpPts}
              />
            ) : (
              /* Drop Zone */
              <div className="w-full h-full flex flex-col items-center justify-center gap-6 text-slate-500 cursor-pointer" onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file?.type.startsWith('image/')) { setBlueprintUrl(URL.createObjectURL(file)); } }}
              >
                <div className="w-32 h-32 rounded-3xl bg-slate-900 border-2 border-dashed border-slate-700 flex items-center justify-center text-5xl">📐</div>
                <div className="text-center">
                  <p className="text-slate-300 font-bold text-lg">Upload a Blueprint</p>
                  <p className="text-slate-500 text-sm mt-1">Drag & drop or click to browse</p>
                  <p className="text-slate-600 text-xs mt-1">PNG, JPG, WebP supported</p>
                </div>
              </div>
            )
          ) : (
            <div
              className="w-full h-full relative"
            onMouseDown={(e) => {
              const isBox = !isDKeyPressed && e.shiftKey;
              const isPath = !isDKeyPressed && (e.metaKey || e.ctrlKey);
              const isMeasure = isDKeyPressed;
              if (isBox || isPath || isMeasure) {
                const rect = e.currentTarget.getBoundingClientRect();
                setInteraction({
                  type: isBox ? 'BOX' : isPath ? 'PATH' : 'MEASURE',
                  start: { x: e.clientX - rect.left, y: e.clientY - rect.top },
                  end: { x: e.clientX - rect.left, y: e.clientY - rect.top }
                });
                // Clear previous committed measurement when starting a new drag
                if (isMeasure) setMeasureMapPts([]);
              }
            }}
            onMouseMove={(e) => {
              if (interaction) {
                const rect = e.currentTarget.getBoundingClientRect();
                setInteraction({ ...interaction, end: { x: e.clientX - rect.left, y: e.clientY - rect.top } });
              }
            }}
          >
            {/* Interaction overlay — BOX: rectangle, PATH: line */}
            {interaction && interaction.type === 'BOX' && (
              <div
                className="absolute z-50 pointer-events-none border-2 bg-blue-500/20 border-blue-500"
                style={{
                  left: Math.min(interaction.start.x, interaction.end.x),
                  top: Math.min(interaction.start.y, interaction.end.y),
                  width: Math.abs(interaction.end.x - interaction.start.x),
                  height: Math.abs(interaction.end.y - interaction.start.y),
                }}
              />
            )}
            {interaction && interaction.type === 'PATH' && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-50">
                <line
                  x1={interaction.start.x} y1={interaction.start.y}
                  x2={interaction.end.x} y2={interaction.end.y}
                  stroke="#f97316" strokeWidth="2" strokeDasharray="8 4"
                />
                <circle cx={interaction.start.x} cy={interaction.start.y} r="4" fill="#f97316" />
                <circle cx={interaction.end.x} cy={interaction.end.y} r="4" fill="#f97316" />
              </svg>
            )}
            {interaction && interaction.type === 'MEASURE' && (() => {
              const dx = interaction.end.x - interaction.start.x;
              const dy = interaction.end.y - interaction.start.y;
              const mx = (interaction.start.x + interaction.end.x) / 2;
              const my = (interaction.start.y + interaction.end.y) / 2;
              const len = Math.sqrt(dx*dx + dy*dy);
              return (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-50">
                  <line x1={interaction.start.x} y1={interaction.start.y} x2={interaction.end.x} y2={interaction.end.y} stroke="#10b981" strokeWidth="2" strokeDasharray="8 4" />
                  <circle cx={interaction.start.x} cy={interaction.start.y} r="5" fill="#10b981" />
                  <circle cx={interaction.end.x} cy={interaction.end.y} r="5" fill="#10b981" />
                  {len > 10 && (
                    <>
                      <rect x={mx - 34} y={my - 22} width="68" height="18" rx="4" fill="#0f172a" stroke="#10b981" strokeWidth="1" />
                      <text x={mx} y={my - 9} fill="#34d399" fontSize="10" fontWeight="700" fontFamily="monospace" textAnchor="middle">measuring…</text>
                    </>
                  )}
                </svg>
              );
            })()}

            <Map
              defaultCenter={mapCenter}
              defaultZoom={zoom}
              onCameraChanged={ev => {
                setMapCenter(ev.detail.center);
                setZoom(ev.detail.zoom);
              }}
              mapTypeId={mapType}
              gestureHandling={(interaction || isDKeyPressed) ? 'none' : 'greedy'}
              disableDefaultUI={true}
              mapId="4504f8b373a3ad2"
              className="w-full h-full"
            >
              <MapHandler 
                interaction={interaction}
                setInteraction={setInteraction}
                placedItems={placedItems}
                setSelectedIds={setSelectedIds}
                selectedProductId={selectedProductId}
                setPlacedItems={setPlacedItems}
                setMeasureMapPts={setMeasureMapPts}
                externalCameraUpdateRef={externalCameraUpdateRef}
                mapCenter={mapCenter}
                zoom={zoom}
              />
              <MeasureHandler
                active={isDKeyPressed}
                pts={measureMapPts}
                setPts={setMeasureMapPts}
              />

              {placedItems.map((item) => {
                const product = PRODUCTS.find(p => p.id === item.productId);
                if (!product) return null; // Skip items whose product has been removed
                const isSelected = selectedIds.includes(item.instanceId);
                return (
                  <AdvancedMarker
                    key={item.instanceId}
                    position={{ lat: item.lat, lng: item.lng }}
                    draggable={!isDKeyPressed}
                    onDragStart={e => {
                      if (e.latLng) lastDragPos.current = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                    }}
                    onDrag={e => {
                      if (e.latLng && lastDragPos.current && isSelected) {
                        const dl = e.latLng.lat() - lastDragPos.current.lat;
                        const dg = e.latLng.lng() - lastDragPos.current.lng;
                        setPlacedItems(prev => prev.map(p => selectedIds.includes(p.instanceId) ? { ...p, lat: p.lat + dl, lng: p.lng + dg } : p));
                        lastDragPos.current = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                      }
                    }}
                    onDragEnd={e => {
                      if (e.latLng && !isSelected) updateItems([item.instanceId], { lat: e.latLng.lat(), lng: e.latLng.lng() });
                      lastDragPos.current = null;
                    }}
                    onClick={(e) => {
                      if (!(e.domEvent.metaKey || e.domEvent.ctrlKey)) {
                        const isMulti = e.domEvent.shiftKey;
                        if (isMulti) {
                          setSelectedIds(prev => prev.includes(item.instanceId) ? prev.filter(i => i !== item.instanceId) : [...prev, item.instanceId]);
                        } else {
                          setSelectedIds([item.instanceId]);
                        }
                      }
                    }}
                  >
                    <motion.div
                      animate={{ 
                        rotate: item.rotation,
                        scale: isSelected ? 1.05 : 1,
                        borderColor: isSelected ? '#f97316' : '#334155',
                        width: product.length * pixelsPerFoot,
                        height: product.width * pixelsPerFoot,
                      }}
                      className={`relative rounded-sm border bg-slate-900/60 shadow-lg flex items-center justify-center ${isSelected ? 'ring-4 ring-orange-500/20' : ''}`}
                    >
                      <div className={`absolute inset-0 opacity-40 ${product.color} rounded-sm`} />
                      <span className="text-[6px] font-black text-white z-10 uppercase text-center px-1">
                        {pixelsPerFoot > 8 ? product.name : ''}
                      </span>
                      {selectedIds.length === 1 && isSelected && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50">
                          <button onClick={() => updateItems([item.instanceId], { rotation: item.rotation - 90 })} className="p-1 text-slate-400">↺</button>
                          <button onClick={() => updateItems([item.instanceId], { rotation: item.rotation + 90 })} className="p-1 text-slate-400">↻</button>
                        </div>
                      )}
                    </motion.div>
                  </AdvancedMarker>
                );
              })}
            </Map>
            </div>
          )}

          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-2/3 bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-[2rem] p-6 shadow-2xl z-20 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  {selectedIds.length === 1 ? (
                    <>
                      <div className="w-16 h-16 bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
                        {(() => { const prod = PRODUCTS.find(p => p.id === [...placedItems, ...blueprintItems].find(i => i.instanceId === selectedIds[0])?.productId); return prod ? <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" /> : null; })()}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold">{PRODUCTS.find(p => p.id === [...placedItems, ...blueprintItems].find(i => i.instanceId === selectedIds[0])?.productId)?.name}</h4>
                        <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-1">{viewMode === 'map' ? 'Geo-Scaling Active' : 'Blueprint Mode'}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center text-3xl border border-orange-500/30">
                        <BoxIcon className="w-8 h-8 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold">Bulk Edit</h4>
                        <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mt-1">{selectedIds.length} Items Selected</div>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-8 px-8 border-x border-slate-800">
                  <div className="flex flex-col gap-2 w-48">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">Rotation <span className="text-orange-500">{selectedIds.length === 1 ? (placedItems.find(i => i.instanceId === selectedIds[0])?.rotation || 0) : 'Mixed'}°</span></div>
                    <input type="range" min="0" max="360" value={selectedIds.length === 1 ? (placedItems.find(i => i.instanceId === selectedIds[0])?.rotation || 0) : 0} onChange={e => updateItems(selectedIds, { rotation: parseInt(e.target.value) })} className="w-full accent-orange-500 bg-slate-800 h-1 appearance-none cursor-pointer" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={deleteSelected} className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl"><Trash2 className="w-5 h-5" /></button>
                  <button className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest">Update Plan</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Plans Drawer — overlays the map section */}
          <PlansDrawer
            isOpen={isPlansOpen}
            onClose={() => setIsPlansOpen(false)}
            plans={plans}
            activePlanId={activePlanId}
            activePlanName={activePlanName}
            onRename={setActivePlanName}
            onSave={handleManualSave}
            onLoad={handleLoadPlan}
            onNew={() => {
              newPlan();
              setPlacedItems([]);
              setBlueprintItems([]);
              setSelectedIds([]);
              setBlueprintUrl(null);
              setBpScale(8);
              setCalMode('idle');
              setCalPts([]);
              setViewMode('map');
              blueprintBlobRef.current = null;
              blobNeedsSave.current    = false;
              historyStack.current     = [];
              setCanUndo(false);
            }}
            onDelete={async (id) => {
              const isActive = id === activePlanId;
              await deletePlan(id);
              if (isActive) {
                const stored = JSON.parse(localStorage.getItem('valtir_plans') || '[]');
                if (stored.length > 0) {
                  await handleLoadPlan(stored[0].id);
                } else {
                  newPlan();
                  setPlacedItems([]);
                  setBlueprintItems([]);
                  setSelectedIds([]);
                  setBlueprintUrl(null);
                  setBpScale(8);
                  setCalMode('idle');
                  setCalPts([]);
                  setViewMode('map');
                  blueprintBlobRef.current = null;
                  blobNeedsSave.current    = false;
                  historyStack.current     = [];
                  setCanUndo(false);
                }
              }
            }}
          />
        </section>
      </main>
    </APIProvider>
  );
}
