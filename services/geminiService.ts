import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateSmartChecklist = async (destination: string, days: number): Promise<Array<{text: string, category: string}>> => {
  if (!apiKey) return [];

  const prompt = `Gere uma lista de itens essenciais para levar em uma viagem de carro para ${destination} com duração de ${days} dias.
  Categorize os itens em: 'Roupas', 'Documentos', 'Carro', 'Higiene', 'Eletrônicos', 'Alimentação'.
  Retorne apenas JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "O nome do item" },
              category: { type: Type.STRING, description: "A categoria do item" }
            },
            required: ['text', 'category']
          }
        }
      }
    });

    const json = response.text;
    if (!json) return [];
    return JSON.parse(json);
  } catch (error) {
    console.error("Erro ao gerar checklist com Gemini:", error);
    return [];
  }
};

export const generateTravelTips = async (destination: string): Promise<string> => {
  if (!apiKey) return "Não foi possível carregar dicas no momento.";

  const prompt = `Dê 3 dicas curtas e valiosas para uma viagem de carro para ${destination}. Foco em segurança ou pontos turísticos no caminho.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Sem dicas disponíveis.";
  } catch (error) {
    console.error("Erro ao gerar dicas:", error);
    return "Erro ao conectar com a IA.";
  }
};
