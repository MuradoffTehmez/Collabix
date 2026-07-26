import { Env, uuid } from '../../util';
import { AIService } from '../ai';

export class VectorService {
  constructor(private env: Env) {}

  async insertDocument(text: string, metadata: Record<string, any> = {}): Promise<string> {
    if (!this.env.VECTORIZE) throw new Error('Vectorize is not configured');

    const ai = new AIService(this.env);
    const vectors = await ai.embed(text);
    const vector = vectors[0];
    const documentId = metadata.id || uuid();

    await this.env.VECTORIZE.insert([
      {
        id: documentId,
        values: vector,
        metadata: { text, ...metadata }
      }
    ]);

    return documentId;
  }
}
