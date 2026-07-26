import { Env } from '../../util';
import { AIService } from '../ai';
import { VectorService } from '../vector';

/**
 * TASK-11 — Workers AI + Vectorize inteqrasiyası (PDR "Vectorize" / "Workers AI").
 *
 * HƏR ŞEY OPSİONALDIR: `AI` və ya `VECTORIZE` binding-i yoxdursa funksiyalar
 * `null` qaytarır və çağıran axın normal davam edir (graceful degradation) —
 * komanda iş sahəsi AI olmadan da tam işlək qalır.
 */
export class TeamAIService {
  constructor(private env: Env) {}

  private get aiReady() { return !!this.env.AI; }
  private get vectorReady() { return !!this.env.VECTORIZE && !!this.env.AI; }

  /** Layihə/tapşırıq mətnini Vectorize indeksinə yazır. */
  async indexTeamDocument(
    teamId: string,
    kind: 'project' | 'task' | 'post' | 'file',
    id: string,
    text: string,
  ): Promise<void> {
    if (!this.vectorReady || !text.trim()) return;
    try {
      const vec = new VectorService(this.env);
      await vec.insertDocument(text.slice(0, 4000), {
        id: `team:${teamId}:${kind}:${id}`,
        teamId, kind, refId: id,
      });
    } catch (e: any) {
      console.error('team vector index failed', kind, id, e?.message || e);
    }
  }

  /**
   * Komanda daxilində semantik axtarış. Nəticələr `teamId`-ə görə filtrlənir —
   * indeks paylaşımlıdır, ona görə başqa komandanın sənədi qayıtmamalıdır.
   */
  async semanticSearch(teamId: string, query: string, topK = 8) {
    if (!this.vectorReady || !query.trim()) return null;
    try {
      const ai = new AIService(this.env);
      const [vector] = await ai.embed(query);
      const res = await this.env.VECTORIZE.query(vector, {
        topK: topK * 3,
        returnValues: false,
        returnMetadata: true,
      });
      return (res.matches || [])
        .filter((m: any) => m?.metadata?.teamId === teamId)
        .slice(0, topK)
        .map((m: any) => ({
          id: m.metadata?.refId, kind: m.metadata?.kind,
          text: m.metadata?.text, score: m.score,
        }));
    } catch (e: any) {
      console.error('team semantic search failed', e?.message || e);
      return null;
    }
  }

  /** Tapşırıq xülasəsi (PDR "Task Summary"). */
  async summarizeTasks(tasks: { title: string; status: string; assignee_name?: string }[]) {
    if (!this.aiReady || !tasks.length) return null;
    try {
      const list = tasks.slice(0, 40)
        .map(t => `- [${t.status}] ${t.title}${t.assignee_name ? ` (${t.assignee_name})` : ''}`)
        .join('\n');
      return await new AIService(this.env).chat(
        `Bu komandanın tapşırıq siyahısıdır. 3-4 cümlə ilə vəziyyəti xülasə et: nə bitib, nə qalıb, risk nədir.\n\n${list}`,
        'Sən komanda menecerinə hesabat verən köməkçisən. Qısa və konkret yaz.',
      );
    } catch (e: any) {
      console.error('task summary failed', e?.message || e);
      return null;
    }
  }

  /** Layihə xülasəsi (PDR "Project Summary"). */
  async summarizeProject(project: { name: string; description?: string }, tasks: { title: string; status: string }[]) {
    if (!this.aiReady) return null;
    try {
      const list = tasks.slice(0, 40).map(t => `- [${t.status}] ${t.title}`).join('\n');
      return await new AIService(this.env).chat(
        `Layihə: ${project.name}\nAçıqlama: ${project.description || '—'}\n\nTapşırıqlar:\n${list}\n\n` +
        'Layihənin hazırkı vəziyyətini 3 cümlə ilə xülasə et.',
        'Sən texniki layihə analitikisən.',
      );
    } catch (e: any) {
      console.error('project summary failed', e?.message || e);
      return null;
    }
  }

  /** Mətndən avtomatik teq (PDR "Auto Tags"). */
  async autoTags(text: string): Promise<string[] | null> {
    if (!this.aiReady || !text.trim()) return null;
    try {
      const raw = await new AIService(this.env).chat(
        `Aşağıdakı mətnə uyğun ən çox 5 texniki teq ver. Yalnız vergüllə ayrılmış siyahı qaytar.\n\n${text.slice(0, 2000)}`,
        'Sən teq generatorusan. Yalnız teqləri qaytar, izah yazma.',
      );
      return String(raw).split(/[,\n]/).map(s => s.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean).slice(0, 5);
    } catch (e: any) {
      console.error('auto tags failed', e?.message || e);
      return null;
    }
  }
}
