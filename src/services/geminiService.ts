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
        Each question must be unique, high-quality, and follow the NCERT pattern.
        Provide a mix of Conceptual, Numerical, and Assertion-Reason types.
        Difficulty should be a mix of Easy, Medium, and Hard.`,
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
