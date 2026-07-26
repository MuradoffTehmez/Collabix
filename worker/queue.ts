import { Env } from './util';
import { SystemEvent, isTeamEvent } from './events';
import { processGeneratePDF } from './jobs/render';
import { processPostCreated } from './jobs/ai';
import { processUserRegistered } from './workflows/welcome';
import { NotificationService } from './services/notification';
import { processTeamEvent } from './jobs/team';

export async function handleQueueBatch(batch: MessageBatch<SystemEvent>, env: Env): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await runTask(env, msg.body);
      msg.ack();
    } catch (e: any) {
      console.error('Queue task failed:', msg.body?.type, e?.message || e);
      msg.retry();
    }
  }
}

export async function runTask(env: Env, event: SystemEvent): Promise<void> {
  // Komanda event-ləri tək yerdən keçir: aktivlik jurnalı + XP + email + workflow.
  // Əvvəl `switch` içində sadalanırdılar və siyahıda olmayan hər yeni event
  // (məs. `TaskCompleted`) səssizcə `default`-a düşüb ITIRILIRDI.
  if (isTeamEvent(event.type)) {
    return processTeamEvent(env, event as any);
  }

  switch (event.type) {
    case 'PostCreated':
      return processPostCreated(env, event);
    case 'GeneratePDF':
      return processGeneratePDF(env, event);
    case 'UserRegistered':
      return processUserRegistered(env, event);
    case 'TaskCompleted': {
      // Qlobal (komandadan kənar) tapşırıq — komanda tapşırığı üçün
      // `TeamTaskCompleted` işlədilir.
      const notif = new NotificationService(env);
      await notif.pushSignal(event.userId, { t: 'xp' });
      return;
    }
    case 'MentionFanout': {
      const names = [...new Set((event.text.match(/@([a-z0-9._]{3,20})/g) || []).map(m => m.slice(1)))].slice(0, 20);
      if (!names.length) return;
      const rows = await env.DB.prepare(
        `SELECT id FROM users WHERE username IN (${names.map(() => '?').join(',')})`,
      ).bind(...names).all<any>();

      const notif = new NotificationService(env);
      for (const r of rows.results) {
        const ok = await notif.notify(r.id, event.fromId, event.fromName, 'mention', event.label, event.postId);
        if (ok) await notif.pushSignal(r.id, { t: 'notif' });
      }
      return;
    }
    case 'ArchiveSweep': {
      const { runArchiveJob } = await import('./archive');
      await runArchiveJob(env);
      return;
    }
    default:
      console.log('Unhandled event type:', (event as any).type);
  }
}
