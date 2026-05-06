'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, FolderOpen, Clock, Save, Check, FileText } from 'lucide-react';
import type { SavedPlan } from '../lib/usePlans';

interface PlansDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plans: SavedPlan[];
  activePlanId: string | null;
  activePlanName: string;
  onRename: (name: string) => void;
  onSave: (name: string) => Promise<void>;
  onLoad: (id: string) => Promise<void>;
  onNew: () => void;
  onDelete: (id: string) => Promise<void>;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function PlansDrawer({
  isOpen, onClose, plans, activePlanId, activePlanName,
  onRename, onSave, onLoad, onNew, onDelete,
}: PlansDrawerProps) {
  const [editedName, setEditedName]   = useState('');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [loadingId, setLoadingId]     = useState<string | null>(null);

  // Sync editedName when drawer opens or active plan changes
  React.useEffect(() => {
    if (isOpen) setEditedName(activePlanName);
  }, [isOpen, activePlanName]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(editedName.trim() || 'Untitled Plan');
    onRename(editedName.trim() || 'Untitled Plan');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    await onLoad(id);
    setLoadingId(null);
    onClose();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  const handleNew = () => {
    onNew();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-slate-950/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute top-0 right-0 h-full w-80 z-40 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-black uppercase tracking-widest text-slate-200">My Plans</span>
                <span className="text-[9px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md">
                  {plans.length}/{10}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Plan */}
            <div className="flex-none p-4 border-b border-slate-800/60">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Current Plan</p>
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-3">
                <input
                  type="text"
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                  placeholder="Plan name..."
                  className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-200 placeholder:text-slate-600"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      saved
                        ? 'bg-emerald-600 text-white'
                        : 'bg-orange-600 hover:bg-orange-500 text-slate-950'
                    }`}
                  >
                    {saved ? (
                      <><Check className="w-3 h-3" /> Saved</>
                    ) : saving ? (
                      'Saving…'
                    ) : (
                      <><Save className="w-3 h-3" /> Save</>
                    )}
                  </button>
                  <button
                    onClick={handleNew}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> New
                  </button>
                </div>
              </div>
            </div>

            {/* Saved Plans List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
              {plans.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                  <FileText className="w-8 h-8 opacity-40" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-center">No saved plans yet.<br />Click Save to create one.</p>
                </div>
              ) : (
                <>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Saved Plans ({plans.length})
                  </p>
                  {plans.map(plan => {
                    const isActive  = plan.id === activePlanId;
                    const isLoading = loadingId === plan.id;
                    const isDeleting = deletingId === plan.id;
                    const totalBarriers = plan.placedItems.length + plan.blueprintItems.length;
                    return (
                      <motion.div
                        key={plan.id}
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 40 }}
                        className={`group relative rounded-xl border p-3 cursor-pointer transition-all ${
                          isActive
                            ? 'bg-orange-500/10 border-orange-500/40'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                        onClick={() => !isActive && handleLoad(plan.id)}
                      >
                        {/* Active dot */}
                        {isActive && (
                          <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-orange-500" />
                        )}

                        <p className={`text-xs font-bold truncate pr-6 ${isActive ? 'text-orange-400' : 'text-slate-200'}`}>
                          {plan.name}
                        </p>

                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-[9px] text-slate-500">
                              <Clock className="w-2.5 h-2.5" />{timeAgo(plan.savedAt)}
                            </span>
                            <span className="text-[9px] text-slate-600">·</span>
                            <span className="text-[9px] text-slate-500">
                              {totalBarriers} barrier{totalBarriers !== 1 ? 's' : ''}
                            </span>
                            {plan.hasBlueprintImage && (
                              <span className="text-[8px] font-bold text-slate-600 uppercase">📐</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleDelete(plan.id, e)}
                              disabled={isDeleting}
                              className="p-1 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {isLoading && (
                          <div className="absolute inset-0 rounded-xl bg-slate-900/80 flex items-center justify-center">
                            <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Loading…</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer note */}
            <div className="flex-none px-4 py-3 border-t border-slate-800/60">
              <p className="text-[8px] text-slate-600 text-center leading-relaxed">
                Plans are stored privately in your browser.<br />Nothing is uploaded to any server.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
