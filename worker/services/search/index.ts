import { Env, Ctx, err, json } from '../../util';
import { AIService } from '../ai';

export class SearchService {
  constructor(private env: Env) {}

  async semanticSearch(query: string, topK: number = 5) {
    if (!this.env.VECTORIZE) throw new Error('Vectorize is not configured');

    const ai = new AIService(this.env);
    const vectors = await ai.embed(query);
    const queryVector = vectors[0];

    const matches = await this.env.VECTORIZE.query(queryVector, {
      topK,
      returnValues: false,
      returnMetadata: true
    });

    return matches.matches;
  }

  // Future features: keywordSearch, hybridSearch
}

// Endpoint Handlers
export async function handleSearchSemantic(c: Ctx) {
  const query = new URL(c.req.url).searchParams.get('q');
  if (!query) return err('?q= parametri tələb olunur.', 400);

  try {
    const searchService = new SearchService(c.env);
    const matches = await searchService.semanticSearch(query);
    return json({ matches });
  } catch (e: any) {
    console.error('Vectorize Search Error:', e);
    return err('Semantik axtarış zamanı xəta baş verdi.', 500);
  }
}
