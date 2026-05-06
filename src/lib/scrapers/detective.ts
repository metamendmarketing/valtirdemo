import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface DetectiveSignal {
  title: string;
  source: string;
  link: string;
  date: string;
  content: string;
  confidence: number;
}

function cleanHtml(html: string): string {
  // Remove scripts, styles, and extra whitespace to fit more content in the prompt
  return html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HUBS = [
  { name: 'Loudoun County Planning', url: 'https://www.loudoun.gov/meetings' },
  { name: 'Columbus Development Commission', url: 'https://www.columbus.gov/Government/Departments/Building-Zoning-Services/Boards-and-Commissions/Development-Commission' },
  { name: 'Dallas City Plan Commission', url: 'https://cityofdallas.legistar.com/Calendar.aspx' },
  { name: 'SEC EDGAR (Data Center Keywords)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?company=&CIK=&type=&owner=include&count=40&action=getcurrent' },
  { name: 'Dominion Energy Filings', url: 'https://www.dominionenergy.com/projects-and-facilities/electric-projects/transmission-projects' },
  { name: 'Duke Energy Projects', url: 'https://www.duke-energy.com/our-company/about-us/electric-transmission-projects' },
  { name: 'EPA Facility Registry (Large Cooling)', url: 'https://www.epa.gov/frs' },
  { name: 'Oncor Transmission (Texas)', url: 'https://www.oncor.com/content/oncordg/en/home/about-us/transmission-projects.html' }
];

export async function fetchDetectiveSignals(): Promise<DetectiveSignal[]> {
  const allSignals: DetectiveSignal[] = [];

  for (const hub of HUBS) {
    try {
      console.log(`Scraping Hub: ${hub.name}...`);
      // Use a signal for timeout to prevent hanging
      const response = await fetch(hub.url, { 
        next: { revalidate: 3600 },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
      });

      if (!response.ok) {
        console.warn(`Hub ${hub.name} returned status ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      const cleanedText = cleanHtml(html);
      
      const prompt = `
        You are an Elite Data Center Construction Intelligence Agent. 
        Analyze the following text extracted from ${hub.name} (${hub.url}).
        
        TASK:
        Identify "Detective Signals" for upcoming data center projects. 
        A signal is anything that hints at a new build, expansion, or infrastructure upgrade.
        
        LEVELS OF EVIDENCE (Lower your threshold):
        - HIGH: Direct mention of "Data Center", "Hyperscale", or "Substation Expansion".
        - MEDIUM (Yellow): Mentions of "Large-scale Industrial", "Tech Park", "High Power Load", "Advanced Tech Facility".
        - LOW (Speculative): Land clearing, general industrial rezoning near known hubs, or utility easement changes.

        LOOK FOR:
        1. PROJECT CODENAMES: e.g., "Project Raven", "Project Stellar", "Project X".
        2. ENTITY NAMES: Hyperscalers (AWS, Google, Microsoft, Meta) or developers (Digital Realty, Equinix, QTS, Vantage).
        3. POWER SIGNALS: Mentions of "Substations", "Transmission Lines", "MW Capacity", "High Voltage".
        4. LAND DEALS: "Industrial Rezoning", "Data Center Overlay District", "Purchase of [X] acres".
        5. MEETING ITEMS: Agenda items about "Technical Reviews" or "Permit Approvals" for technology parks.

        OUTPUT FORMAT:
        Return a JSON array of signals. Each signal MUST have:
        - "title": A concise headline (e.g., "New Substation Approved - Loudoun East").
        - "content": A 2-3 sentence summary of the evidence found.
        - "confidence": 0.0 to 1.0.
        - "link": The direct link if found, else "${hub.url}".
        
        If no signals are found, return exactly []. Do not include any other text.
        
        TEXT TO ANALYZE:
        ${cleanedText.substring(0, 15000)}
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const signals = JSON.parse(jsonStr);

      signals.forEach((s: any) => {
        allSignals.push({
          ...s,
          source: hub.name,
          date: new Date().toISOString(),
          link: s.link || hub.url
        });
      });

    } catch (error) {
      console.error(`Error scraping ${hub.name}:`, error.message);
    }
  }

  return allSignals;
}
