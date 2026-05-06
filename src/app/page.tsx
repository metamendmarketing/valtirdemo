'use client';

import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  MapPin, 
  Search, 
  ArrowRight, 
  Activity,
  Layers,
  ExternalLink,
  Info
} from 'lucide-react';
import USAMap from '@/components/USAMap';

// Simplified Lead Interface
interface Lead {
  id: string;
  title: string;
  link: string;
  source: string;
  date: string;
  confidence: number;
  location: string;
  capacity: string;
  summary: string;
  company: string;
  type: 'OFFICIAL' | 'MEDIA';
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);

  const hubs = [
    { id: 'nova', label: 'Northern Virginia', coordinates: [-77.48, 39.04], matches: ['virginia', 'loudoun', 'ashburn', 'prince william'] },
    { id: 'cbus', label: 'Columbus, OH', coordinates: [-82.99, 39.96], matches: ['columbus', 'ohio', 'new albany'] },
    { id: 'dal', label: 'Dallas, TX', coordinates: [-96.79, 32.77], matches: ['dallas', 'texas', 'fort worth', 'plano'] },
    { id: 'phx', label: 'Phoenix, AZ', coordinates: [-112.07, 33.44], matches: ['phoenix', 'arizona', 'mesa', 'chandler'] },
    { id: 'sv', label: 'Silicon Valley', coordinates: [-121.95, 37.35], matches: ['silicon valley', 'california', 'santa clara', 'san jose'] },
    { id: 'atl', label: 'Atlanta, GA', coordinates: [-84.38, 33.74], matches: ['atlanta', 'georgia', 'douglasville'] },
  ];

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leads?analyze=true');
      const data = await res.json();
      
      // Flatten signals into a simplified list for V2
      const flattened: Lead[] = data.leads.flatMap((project: any) => 
        (project.rawSignals || []).map((sig: any, idx: number) => ({
          id: `${project.id}-${idx}`,
          title: project.title,
          link: sig.link,
          source: sig.source,
          date: sig.date,
          confidence: project.analysis?.confidence || 0.5,
          location: project.analysis?.location || 'Regional',
          capacity: project.analysis?.capacity || 'TBD',
          summary: sig.content || project.analysis?.summary || 'No detailed evidence found.',
          company: project.analysis?.company || 'Unknown Entity',
          type: project.types?.includes('OFFICIAL') ? 'OFFICIAL' : 'MEDIA'
        }))
      );
      setLeads(flattened);
    } catch (err) {
      console.error('V2 Fetch Failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const hubData = hubs.map(hub => {
    const matchingLeads = leads.filter(l => 
      hub.matches.some(m => 
        l.location.toLowerCase().includes(m) || 
        l.title.toLowerCase().includes(m) ||
        l.summary.toLowerCase().includes(m) ||
        hub.label.toLowerCase().includes(m)
      )
    );
    return {
      ...hub,
      leads: matchingLeads,
      signals: matchingLeads.length,
      confidenceLevel: matchingLeads.some(l => l.type === 'OFFICIAL') ? 'HIGH' : 'MEDIUM'
    };
  }).filter(h => h.signals > 0 || h.id === 'nova' || h.id === 'atl');

  const activeHub = hubData.find(h => h.id === selectedHubId);

  // Group active hub leads into projects for display
  const projects = activeHub ? Array.from(new Set(activeHub.leads.map(l => l.title))).map(title => {
    const projectLeads = activeHub.leads.filter(l => l.title === title);
    const mainLead = projectLeads[0];
    return {
      id: mainLead.id.split('-')[0],
      title: title,
      company: mainLead.company,
      location: mainLead.location,
      capacity: mainLead.capacity,
      summary: mainLead.summary,
      signals: projectLeads,
      type: projectLeads.some(l => l.type === 'OFFICIAL') ? 'OFFICIAL' : 'MEDIA'
    };
  }) : [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-10 flex flex-col font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <span className="text-emerald-500">Valtir Intelligence</span>
            <span className="text-slate-700 font-light text-xl">|</span>
            <span className="text-sm text-slate-500 uppercase tracking-[0.2em] font-semibold">Strategic Heatmap</span>
          </h1>
          <p className="text-slate-500 text-xs">Direct Signal Feed & Market Heatmap</p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/30 border border-slate-800/50 rounded-2xl">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{leads.length} Active Signals</span>
          </div>
          <button 
            onClick={fetchLeads}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_25px_rgba(16,185,129,0.2)]"
          >
            Refresh Grid
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-8">
        {/* Map View */}
        <div className={`transition-all duration-700 ease-in-out ${activeHub ? 'col-span-12 lg:col-span-7' : 'col-span-12'}`}>
          <USAMap 
            points={hubData as any} 
            onPointClick={(p) => setSelectedHubId(p.id)}
            selectedPointId={selectedHubId || undefined}
          />
        </div>

        {/* Intelligence Feed Side-Panel */}
        {activeHub && (
          <div className="col-span-12 lg:col-span-5 h-[calc(100vh-200px)] animate-in slide-in-from-right duration-500">
            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-[2.5rem] p-8 h-full flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{activeHub.label}</h2>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{projects.length} Active Projects</span>
                  </div>
                </div>
                <button onClick={() => setSelectedHubId(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <span className="text-2xl text-slate-500 hover:text-white">&times;</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-30 italic">
                    <Search className="w-12 h-12 mb-4" />
                    <p>Scanning sector for signs of life...</p>
                  </div>
                ) : (
                  projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Sub-component to manage its own expansion state reliably
function ProjectCard({ project }: { project: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group p-6 rounded-3xl bg-slate-950/40 border border-slate-800/50 hover:border-emerald-500/40 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-2">
          <span className={`text-[9px] font-black px-2 py-1 rounded-lg tracking-widest ${
            project.type === 'OFFICIAL' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'
          }`}>
            {project.type}
          </span>
          <span className="text-[9px] font-black px-2 py-1 rounded-lg tracking-widest bg-emerald-500/10 text-emerald-500">
            {project.signals.length} {project.signals.length === 1 ? 'SIGNAL' : 'SIGNALS'}
          </span>
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-200 group-hover:text-emerald-400 transition-colors mb-3 leading-tight">
        {project.company !== 'Unknown Entity' ? project.company : project.title}
      </h3>

      <p className="text-xs text-slate-500 mb-6 flex items-center gap-2">
        <MapPin className="w-3 h-3" /> {project.location}
      </p>

      <div className="flex flex-col gap-3">
        <button 
          onClick={() => setExpanded(!expanded)}
          className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
            expanded ? 'bg-slate-800 text-white border border-slate-700' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {expanded ? 'Collapse Evidence' : 'View Source Evidence'}
          <ArrowRight className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`} />
        </button>

        {expanded && (
          <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {project.signals.map((sig: any, idx: number) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/40">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">{sig.source}</span>
                  <span className="text-[9px] font-mono text-slate-600">{new Date(sig.date).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  {sig.summary}
                </p>
                <a href={sig.link} target="_blank" className="flex items-center gap-2 text-[9px] font-bold text-slate-500 hover:text-white transition-colors">
                  Open Direct Link <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
