import { Env } from '../../util';

export interface AIProvider {
  chat(prompt: string, systemPrompt?: string): Promise<string>;
  embed(text: string | string[]): Promise<number[][]>;
}

// Model id-ləri BİR yerdə. `@cf/meta/llama-3-8b-instruct` 2026-05-30-da
// deprecate edildi və çağırışlar `5028: This model was deprecated` ilə sınırdı —
// AI funksiyaları səssizcə işləmirdi. Cari qarşılığı 3.1 "fast" variantıdır
// (128k kontekst, deprecate edilməyib).
// Model adı `vars` ilə override oluna bilər ki, növbəti köçürmə deploy tələb etməsin.
const DEFAULT_CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
// 768 ölçülü embedding — Vectorize indeksi bu ölçüyə görə qurulub, dəyişdirmək
// indeksin yenidən qurulmasını tələb edər.
const DEFAULT_EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';

export class WorkersAIProvider implements AIProvider {
  constructor(private env: Env) { }

  async chat(prompt: string, systemPrompt: string = `Sən Collabix platformasının rəsmi AI köməkçisisən.

Missiyan:
İstifadəçilərə proqramlaşdırma, proqram təminatı, texnologiya və Collabix platforması barədə düzgün və peşəkar kömək göstərməkdir.

Qaydalar:

- İstifadəçinin yazdığı dildə cavab ver.
- Dil müəyyən edilə bilməzsə Azərbaycan dilindən istifadə et.
- Cavablar qısa, dəqiq və peşəkar olsun.
- Uydurma məlumat vermə.
- Əmin deyilsənsə bunu açıq şəkildə bildir.
- Mövcud olmayan API, kitabxana və funksiyalar yaratma.
- Mövcud olmayan Collabix funksiyalarını mövcud kimi göstərmə.
- Məntiqi addım-addım düşün.
- Ən yaxşı praktikaları tətbiq et.

Kod yazarkən:

- Production səviyyəsində kod yaz.
- Təhlükəsizlik qaydalarına riayət et.
- Performansı nəzərə al.
- Müasir texnologiyalardan istifadə et.
- Lazım olduqda bütün faylı yaz.
- Kod bloklarını düzgün formatlaşdır.

Markdown:

- Başlıqlardan istifadə et.
- Siyahılardan istifadə et.
- Kodu həmişə uyğun dil etiketi ilə yaz.

Collabix:

- Platforma haqqında yalnız məlum olan məlumatlara əsaslan.
- Əgər funksiya mövcud deyilsə bunu açıq bildir.`): Promise<string> {
    if (!this.env.AI) throw new Error('Workers AI is not configured');

    const model = (this.env as any).AI_CHAT_MODEL || DEFAULT_CHAT_MODEL;
    const response = await this.env.AI.run(model, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    return (response as any).response;
  }

  async embed(text: string | string[]): Promise<number[][]> {
    if (!this.env.AI) throw new Error('Workers AI is not configured');

    const model = (this.env as any).AI_EMBED_MODEL || DEFAULT_EMBED_MODEL;
    const input = Array.isArray(text) ? text : [text];
    const response = await this.env.AI.run(model, { text: input });

    return (response as any).data;
  }
}

// Factory for getting the appropriate provider
export function getAIProvider(env: Env, providerName: string = 'workers-ai'): AIProvider {
  switch (providerName) {
    case 'workers-ai':
      return new WorkersAIProvider(env);
    // Expandable for OpenAI, Gemini, Claude, etc.
    // case 'openai': return new OpenAIProvider(env.OPENAI_API_KEY);
    default:
      return new WorkersAIProvider(env);
  }
}
