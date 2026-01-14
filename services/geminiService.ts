
import { GoogleGenAI, Type } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async analyzeGarbledText(textSnippet: string): Promise<{ encoding: string; cleanedText: string }> {
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        You are a character encoding expert. I have a music CUE file that appears garbled (Mojibake).
        Based on the garbled snippet below, identify the ORIGINAL intended encoding.
        
        Common suspects:
        - Simplified Chinese: 'gb18030' or 'gbk'
        - Traditional Chinese: 'big5'
        - Japanese: 'shift-jis' or 'euc-jp'
        - Korean: 'euc-kr'
        - Western: 'windows-1252'

        Garbled Snippet:
        "${textSnippet}"

        If you can recognize song titles or artist names within the mess, provide a cleaned version.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            encoding: {
              type: Type.STRING,
              description: "The identified IANA encoding name (e.g., 'gb18030', 'big5', 'shift-jis')."
            },
            cleanedText: {
              type: Type.STRING,
              description: "A small sample of the text if you successfully reconstructed it."
            }
          },
          required: ["encoding", "cleanedText"]
        }
      }
    });

    try {
      const text = response.text || '{}';
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return { encoding: 'gb18030', cleanedText: textSnippet };
    }
  }
}

export const geminiService = new GeminiService();
