import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface AnalyzedLead {
  company: string;
  location: string;
  capacity: string;
  status: string;
  confidence: number;
  summary: string;
}

export async function analyzeLead(title: string, content: string): Promise<AnalyzedLead | null> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return null;
  }

  const prompt = `
    Analyze the following news headline and snippet about a data center project.
    Extract the following information in JSON format:
    - company: The name of the company building/leasing the data center.
    - location: The city and state.
    - capacity: Power capacity in MW (if mentioned, else "TBD").
    - status: One of "Planning", "Permitting", "Under Construction", "Operational", or "Unknown".
    - confidence: A decimal between 0 and 1 representing how certain the project is.
    - summary: A 1-sentence summary of the detective signal.

    Headline: ${title}
    Snippet: ${content}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up JSON if LLM adds markdown blocks
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Analysis Error:", error);
    // Fallback to basic extraction from title if AI fails
    return {
      company: title.split(' ')[0] || "Unknown Entity",
      location: "Regional",
      capacity: "TBD",
      status: "Scanning",
      confidence: 0.5,
      summary: title
    };
  }
}
