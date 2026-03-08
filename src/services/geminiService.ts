import { GoogleGenAI, Type } from "@google/genai";
import { Question, PHYSICS_TOPICS } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateQuestions(
  subject: 'Physics' | 'Chemistry' | 'Biology',
  count: number,
  subSections: string[]
): Promise<Question[]> {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let topicContext = '';
      if (subject === 'Physics' && subSections.length > 0) {
        topicContext = subSections.map(ch => {
          const topics = PHYSICS_TOPICS[ch];
          return topics ? `${ch} (Topics: ${topics.join(', ')})` : ch;
        }).join('; ');
      } else if (subSections.length > 0) {
        topicContext = subSections.join(', ');
      }

      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate ${count} NEET 2026 level mock test questions for ${subject}.
        ${topicContext ? `Focus on these areas: ${topicContext}.` : ''}
        CRITICAL: Strictly adhere to the updated NEET 2026 syllabus. Do NOT include any questions from removed topics. 
        For Chemistry, explicitly EXCLUDE: "s-block elements", "Solid State", "States of Matter", "Surface Chemistry", "Metallurgy", "Hydrogen", "Environmental Chemistry", "Polymers", and "Chemistry in Everyday Life".
        For Physics, explicitly EXCLUDE: "Radioactivity (alpha, beta, gamma decay)", "Transistors", "Communication Systems", "Earth's Magnetism", "Doppler Effect", and "Resolving Power of Optical Instruments".
        For Biology, explicitly EXCLUDE: "Transport in Plants", "Mineral Nutrition", "Digestion and Absorption", "Reproduction in Organisms", "Strategies for Enhancement in Food Production", and "Environmental Issues".
        
        ROLE & PATTERN: Think exactly like the NEET 2026 question paper makers. Generate questions that strictly follow previous NEET exam patterns. Include variations of the most frequently asked questions from past NEET papers.
        Each question must be unique, high-quality, and follow the NCERT pattern.
        Provide a mix of Conceptual, Numerical, and Assertion-Reason types.
        Difficulty should be a mix of Easy, Medium, and Hard.
        
        IMPORTANT FORMATTING RULE: If you use LaTeX formatting or any backslashes, you MUST double-escape them in the JSON string (e.g., use \\\\alpha instead of \\alpha, and \\\\frac instead of \\frac) to avoid JSON parsing errors.
        Use proper LaTeX math mode for all formulas, units, and symbols. Use $...$ for inline math (e.g., $5 \\\\Omega$, $10 \\\\mu F$, $v = u + at$) and $$...$$ for block math. Do not use plain text for symbols like omega or mu.
        
        VISUAL EXPLANATION: If a diagram helps explain the answer (e.g., circuit diagrams, biological processes, chemical structures, free body diagrams), provide a clean, valid SVG code string in the \`explanationDiagramSvg\` field. The SVG must be responsive (use viewBox) and visually appealing. Do not include markdown formatting like \`\`\`svg in the string, just the raw <svg> tag.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Exactly 4 options"
                },
                correctAnswer: { type: Type.INTEGER, description: "Index 0-3" },
                explanation: { type: Type.STRING },
                explanationDiagramSvg: { type: Type.STRING, description: "Optional raw SVG code string for visual explanation" },
                difficulty: { type: Type.STRING, description: "Easy, Medium, or Hard" },
                type: { type: Type.STRING, description: "Conceptual, Numerical, or Assertion-Reason" },
                section: { type: Type.STRING, description: "Sub-section or chapter name" }
              },
              required: ["question", "options", "correctAnswer", "explanation", "difficulty", "type"]
            }
          }
        }
      });

      const response = await model;
      const text = response.text;
      if (!text) throw new Error("Empty response from AI");

      const rawQuestions = JSON.parse(text);
      return rawQuestions.map((q: any, index: number) => ({
        ...q,
        id: `ai_${subject}_${Date.now()}_${index}_${attempt}`,
        subject,
        chapter: subject === 'Physics' ? q.section : undefined,
        section: subject !== 'Physics' ? q.section : undefined
      }));
    } catch (e) {
      console.error(`Attempt ${attempt} failed for ${subject}:`, e);
      lastError = e;
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error(`All ${maxRetries} attempts failed for ${subject}.`);
  return [];
}
