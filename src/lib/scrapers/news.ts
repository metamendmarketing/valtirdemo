import Parser from 'rss-parser';

export interface NewsLead {
  title: string;
  link: string;
  content: string;
  date: string;
  source: string;
}

const FEEDS = [
  { name: 'Data Center Dynamics', url: 'https://www.datacenterdynamics.com/en/rss/' },
  { name: 'Data Center Frontier', url: 'https://www.datacenterfrontier.com/rss' },
  { name: 'Data Center Knowledge', url: 'https://www.datacenterknowledge.com/rss.xml' },
  { name: 'AWS Infrastructure', url: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/' },
  { name: 'Google Blog', url: 'https://www.googleblog.com/feeds/posts/default' },
];

export async function fetchNewsLeads(): Promise<NewsLead[]> {
  const parser = new Parser({
    timeout: 5000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const allLeads: NewsLead[] = [];

  for (const feed of FEEDS) {
    try {
      console.log(`Fetching RSS: ${feed.name}...`);
      const feedData = await parser.parseURL(feed.url);
      const leads = feedData.items.map(item => ({
        title: item.title || 'Untitled',
        link: item.link || '',
        content: item.contentSnippet || item.content || '',
        date: item.pubDate || new Date().toISOString(),
        source: feed.name,
      }));
      allLeads.push(...leads);
    } catch (error: any) {
      console.error(`RSS Error [${feed.name}]:`, error.message);
    }
  }

  return allLeads.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function filterForConstruction(leads: NewsLead[]): NewsLead[] {
  const keywords = [
    'construction', 'build', 'campus', 'facility', 'expansion', 
    'breaking ground', 'permit', 'land acquisition', 'substation',
    'utility', 'grid', 'zoning', 'planning', 'hyperscale', 'data center',
    'industrial', 'technology park', 'digital infrastructure', 'power request',
    'infrastructure', 'server', 'hosting', 'cloud', 'colocation'
  ];

  return leads.filter(lead => {
    const text = (lead.title + ' ' + lead.content).toLowerCase();
    // Lower threshold: even one keyword is enough to flag it
    return keywords.some(keyword => text.includes(keyword));
  });
}

export function aggregateLeads(leads: NewsLead[]) {
  const groups: { [key: string]: { leads: NewsLead[], signals: number, types: Set<string> } } = {};

  const detectiveSources = [
    'Loudoun County Planning',
    'Columbus Development Commission',
    'Dallas City Plan Commission',
    'SEC EDGAR (Data Center Keywords)',
    'Dominion Energy Filings',
    'Duke Energy Projects',
    'EPA Facility Registry (Large Cooling)',
    'Oncor Transmission (Texas)'
  ];

  leads.forEach(lead => {
    const cleanTitle = lead.title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (cleanTitle.length < 5) return;

    const isDetective = detectiveSources.includes(lead.source);
    
    let matchedKey = null;
    for (const key in groups) {
      const keyWords = key.split(' ').filter(w => w.length > 3);
      const leadWords = cleanTitle.split(' ').filter(w => w.length > 3);
      const intersection = keyWords.filter(w => leadWords.includes(w));
      
      if (intersection.length >= 2) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey) {
      groups[matchedKey].leads.push(lead);
      const sources = new Set(groups[matchedKey].leads.map(l => l.source));
      groups[matchedKey].signals = sources.size;
      groups[matchedKey].types.add(isDetective ? 'OFFICIAL' : 'MEDIA');
    } else {
      groups[cleanTitle] = {
        leads: [lead],
        signals: 1,
        types: new Set([isDetective ? 'OFFICIAL' : 'MEDIA'])
      };
    }
  });

  return Object.values(groups)
    .filter(g => g.leads.length > 0)
    .map(g => ({
      ...g,
      types: Array.from(g.types)
    }))
    .sort((a, b) => {
      const aScore = a.signals + (a.types.includes('OFFICIAL') ? 10 : 0);
      const bScore = b.signals + (b.types.includes('OFFICIAL') ? 10 : 0);
      return bScore - aScore;
    });
}
