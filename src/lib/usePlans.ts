/**
 * usePlans.ts
 * Custom hook for managing named, persistent site plans.
 *
 * Plan metadata (items, map state) → localStorage
 * Blueprint images (Blobs)        → IndexedDB via planStore.ts
 */

import { useState, useCallback } from 'react';
import { saveBlueprintBlob, loadBlueprintBlob, deleteBlueprintBlob } from './planStore';

const PLANS_KEY  = 'valtir_plans';
const ACTIVE_KEY = 'valtir_active_plan';
const MAX_PLANS  = 10;

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlacedItem {
  instanceId: string;
  productId: string;
  lat: number;
  lng: number;
  rotation: number;
}

export interface BlueprintItem {
  instanceId: string;
  productId: string;
  x: number;
  y: number;
  rotation: number;
}

export interface SavedPlan {
  id: string;
  name: string;
  savedAt: number;
  mapCenter: { lat: number; lng: number };
  zoom: number;
  mapType: 'roadmap' | 'satellite' | 'hybrid';
  viewMode: 'map' | 'blueprint';
  placedItems: PlacedItem[];
  blueprintItems: BlueprintItem[];
  bpScale: number;
  selectedProductId: string;
  hasBlueprintImage: boolean;
}

export interface PlanState {
  placedItems: PlacedItem[];
  blueprintItems: BlueprintItem[];
  mapCenter: { lat: number; lng: number };
  zoom: number;
  mapType: 'roadmap' | 'satellite' | 'hybrid';
  viewMode: 'map' | 'blueprint';
  bpScale: number;
  selectedProductId: string;
  hasBlueprintImage: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function loadPlansFromStorage(): SavedPlan[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(PLANS_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePlansToStorage(plans: SavedPlan[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function usePlans() {
  const [plans, setPlans] = useState<SavedPlan[]>(() => loadPlansFromStorage());

  const [activePlanId, setActivePlanId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(ACTIVE_KEY);
    // Only restore if the plan actually exists
    const all = loadPlansFromStorage();
    return stored && all.some(p => p.id === stored) ? stored : null;
  });

  const [activePlanName, setActivePlanName] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Untitled Plan';
    const activeId = localStorage.getItem(ACTIVE_KEY);
    const all      = loadPlansFromStorage();
    return all.find(p => p.id === activeId)?.name ?? 'Untitled Plan';
  });

  /**
   * Save the current state as the active plan.
   * @param state       — full serializable planner state
   * @param name        — optional rename; omit to keep existing name
   * @param blueprintBlob — pass the raw File/Blob only when a NEW blueprint was just loaded;
   *                        omit on subsequent auto-saves to avoid redundant IndexedDB writes
   */
  const saveCurrentPlan = useCallback(async (
    state: PlanState,
    name?: string,
    blueprintBlob?: Blob | null,
  ): Promise<string> => {
    const currentId   = activePlanId ?? generateId();
    const planName    = name ?? activePlanName;

    const plan: SavedPlan = {
      id:      currentId,
      name:    planName,
      savedAt: Date.now(),
      ...state,
    };

    // Write blueprint blob to IndexedDB only when explicitly supplied
    if (blueprintBlob) {
      await saveBlueprintBlob(currentId, blueprintBlob);
    } else if (!state.hasBlueprintImage) {
      // Blueprint was removed — clean up IndexedDB
      await deleteBlueprintBlob(currentId).catch(() => {});
    }

    // Upsert into plans list, keep newest MAX_PLANS
    const existing = loadPlansFromStorage();
    const idx      = existing.findIndex(p => p.id === currentId);
    let updated: SavedPlan[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = plan;
    } else {
      updated = [plan, ...existing].slice(0, MAX_PLANS);
    }

    savePlansToStorage(updated);
    localStorage.setItem(ACTIVE_KEY, currentId);
    setPlans(updated);
    setActivePlanId(currentId);
    if (name) setActivePlanName(planName);

    return currentId;
  }, [activePlanId, activePlanName]);

  /**
   * Load a saved plan by ID.
   * Returns the plan data AND a fresh Blob URL for the blueprint (or null).
   * The caller is responsible for revoking any previous Blob URL.
   */
  const loadPlan = useCallback(async (
    id: string,
  ): Promise<{ plan: SavedPlan; blueprintUrl: string | null }> => {
    const stored = loadPlansFromStorage();
    const plan   = stored.find(p => p.id === id);
    if (!plan) throw new Error(`Plan "${id}" not found in localStorage`);

    let blueprintUrl: string | null = null;
    if (plan.hasBlueprintImage) {
      const blob = await loadBlueprintBlob(id);
      if (blob) blueprintUrl = URL.createObjectURL(blob);
    }

    localStorage.setItem(ACTIVE_KEY, id);
    setActivePlanId(id);
    setActivePlanName(plan.name);

    return { plan, blueprintUrl };
  }, []);

  /** Reset to a blank plan (clears active ID so next save creates a new slot). */
  const newPlan = useCallback(() => {
    setActivePlanId(null);
    setActivePlanName('Untitled Plan');
    localStorage.removeItem(ACTIVE_KEY);
  }, []);

  /** Permanently delete a plan from localStorage and its blueprint from IndexedDB. */
  const deletePlan = useCallback(async (id: string) => {
    await deleteBlueprintBlob(id).catch(() => {});
    const updated = loadPlansFromStorage().filter(p => p.id !== id);
    savePlansToStorage(updated);
    setPlans(updated);

    // If the deleted plan was active, switch to most-recent remaining
    if (activePlanId === id) {
      const next = updated[0];
      if (next) {
        setActivePlanId(next.id);
        setActivePlanName(next.name);
        localStorage.setItem(ACTIVE_KEY, next.id);
      } else {
        setActivePlanId(null);
        setActivePlanName('Untitled Plan');
        localStorage.removeItem(ACTIVE_KEY);
      }
    }
  }, [activePlanId]);

  return {
    plans,
    activePlanId,
    activePlanName,
    setActivePlanName,
    saveCurrentPlan,
    loadPlan,
    newPlan,
    deletePlan,
  };
}
