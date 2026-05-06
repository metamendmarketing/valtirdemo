import { NextResponse } from 'next/server';
import { fetchNewsLeads, filterForConstruction, aggregateLeads } from '@/lib/scrapers/news';
import { fetchDetectiveSignals } from '@/lib/scrapers/detective';
import { analyzeLead } from '@/lib/intelligence';
import crypto from 'crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shouldAnalyze = searchParams.get('analyze') === 'true';

  try {
    const [newsLeads, detectiveSignals] = await Promise.all([
      fetchNewsLeads(),
      fetchDetectiveSignals()
    ]);

    const allLeads = [
      ...filterForConstruction(newsLeads),
      ...detectiveSignals
    ];

    // V2: We still aggregate for the map counts, but we return a flattened list of projects
    // to ensure every piece of evidence is visible without complex toggle logic.
    const aggregated = aggregateLeads(allLeads);
    const results = [];

    for (let i = 0; i < aggregated.length; i++) {
      const group = aggregated[i];
      const mainLead = group.leads[0];
      
      // Stable ID based on the project title
      const projectId = crypto.createHash('md5').update(mainLead.title).digest('hex');
      
      let analysis = null;
      if (shouldAnalyze && i < 10) { // Analyze top 10 projects
        analysis = await analyzeLead(mainLead.title, mainLead.content);
      }

      results.push({
        id: projectId,
        title: mainLead.title,
        link: mainLead.link,
        date: mainLead.date,
        sources: Array.from(new Set(group.leads.map(l => l.source))),
        signalCount: group.signals,
        rawSignals: group.leads.map(l => ({
          source: l.source,
          content: l.content,
          link: l.link,
          date: l.date
        })),
        types: group.types,
        analysis: analysis || {
          company: mainLead.title.split(' ')[0] || "Unknown Entity",
          location: "Regional",
          capacity: "TBD",
          status: "Scanning",
          confidence: 0.5,
          summary: mainLead.content.substring(0, 100) + "..."
        }
      });
    }

    return NextResponse.json({ 
      leads: results,
      totalSignals: allLeads.length,
      projectCount: results.length
    });

  } catch (error) {
    console.error('API V2 Error:', error);
    
    // Simplified Mock Fallback for V2
    const mockLeads = [
      {
        id: 'mock-nova-1',
        title: 'Project Raven - Hyperscale Expansion',
        signalCount: 2,
        rawSignals: [
          { source: 'Loudoun County Planning', content: 'Technical review for 2.5M sq ft data center campus in Ashburn.', link: '#', date: new Date().toISOString() },
          { source: 'Dominion Energy', content: '200MW substation request at Belmont substation.', link: '#', date: new Date().toISOString() }
        ],
        types: ['OFFICIAL'],
        analysis: { company: 'AWS', location: 'Ashburn, VA', capacity: '200MW', status: 'Planning', confidence: 0.95, summary: 'Highly probable hyperscale expansion confirmed by utility load request.' }
      },
      {
        id: 'mock-atl-1',
        title: 'Lithia Springs Industrial Clearing',
        signalCount: 1,
        rawSignals: [
          { source: 'Local Media', content: '150 acres being cleared in Douglas County data center corridor.', link: '#', date: new Date().toISOString() }
        ],
        types: ['MEDIA'],
        analysis: { company: 'Potential Hyperscale', location: 'Lithia Springs, GA', capacity: 'TBD', status: 'Unknown', confidence: 0.4, summary: 'Speculative land clearing in high-density DC corridor.' }
      }
    ];

    return NextResponse.json({ leads: mockLeads, totalSignals: 3, projectCount: 2 });
  }
}
