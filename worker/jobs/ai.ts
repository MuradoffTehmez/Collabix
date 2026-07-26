import { Env } from '../util';
import { EventPayload } from '../events';
import { VectorService } from '../services/vector';
import { NotificationService } from '../services/notification';

export async function processPostCreated(env: Env, event: EventPayload<'PostCreated'>): Promise<void> {
  // 1. PostFanout (köhnə məntiq)
  const FANOUT_LIMIT = 500;
  const followers = await env.DB.prepare(
    'SELECT follower_id FROM follows WHERE target_id = ? LIMIT ?',
  ).bind(event.authorId, FANOUT_LIMIT).all<any>();

  const preview = event.text.slice(0, 60);
  const notificationService = new NotificationService(env);
  for (const f of followers.results) {
    const ok = await notificationService.notify(
      f.follower_id, event.authorId, event.authorName,
      'post', preview ? `yeni paylaşım: ${preview}` : 'yeni paylaşım', event.postId
    );
    if (ok) await notificationService.pushSignal(f.follower_id, { t: 'notif' });
  }

  // 2. AI Embedding for Semantic Search / RAG
  try {
    const vectorService = new VectorService(env);
    await vectorService.insertDocument(event.text, {
      id: event.postId,
      authorId: event.authorId,
      type: 'post'
    });
  } catch (err) {
    console.error('Failed to embed post:', err);
  }
}
