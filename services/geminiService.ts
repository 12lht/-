import { GoogleGenAI } from "@google/genai";
import { GeminiModel } from '../types';

// Ensure API Key is available
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

/**
 * Analyzes the current canvas drawing.
 */
export const analyzeDrawing = async (base64Image: string): Promise<string> => {
  try {
    if (!apiKey) throw new Error("API Key is missing");

    // Remove header if present (data:image/png;base64,)
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: GeminiModel.VISION,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
            }
          },
          {
            text: "请用中文简要描述你在这个草图中看到的内容。语气要生动有趣，富有想象力。如果画得很抽象，可以猜猜是什么。"
          }
        ]
      }
    });

    return response.text || "无法识别内容";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI 暂时无法连接，请稍后再试。";
  }
};

/**
 * Provides creative suggestions or feedback based on the drawing.
 */
export const getCreativeSuggestions = async (base64Image: string): Promise<string> => {
  try {
    if (!apiKey) throw new Error("API Key is missing");
    
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: GeminiModel.VISION,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
            }
          },
          {
            text: "作为一位艺术导师，请用中文点评这幅画。给出1个优点和1个改进建议。"
          }
        ]
      }
    });

    return response.text || "暂无建议";
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return "获取建议失败。";
  }
};
