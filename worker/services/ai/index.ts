import { Env, Ctx, err, json } from '../../util';
import { getAIProvider, AIProvider } from '../../providers/ai';

export class AIService {
  private provider: AIProvider;

  constructor(env: Env) {
    this.provider = getAIProvider(env);
  }

  async chat(prompt: string, systemPrompt?: string): Promise<string> {
    return this.provider.chat(prompt, systemPrompt);
  }

  async embed(text: string | string[]): Promise<number[][]> {
    return this.provider.embed(text);
  }

  // Future modular features: mentor, review, summary, translation, quiz, moderation
  async summarize(text: string): Promise<string> {
    return this.provider.chat(`Aşağıdakı mətni qısaca xülasə et:\n\n${text}`, 'Sən xülasə çıxaran köməkçisən.');
  }
}

// Endpoint Handlers
export async function handleChat(c: Ctx) {
  const { prompt } = await c.req.json<{ prompt: string }>().catch(() => ({ prompt: '' }));
  if (!prompt) return err('Prompt tələb olunur.', 400);

  try {
    const aiService = new AIService(c.env);
    const result = await aiService.chat(prompt);
    return json({ result });
  } catch (e: any) {
    console.error('AI Error:', e);
    return err('AI sorğusu zamanı xəta baş verdi.', 500);
  }
}
