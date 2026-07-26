import { Env } from '../util';
import { EventPayload } from '../events';

export async function processUserRegistered(env: Env, event: EventPayload<'UserRegistered'>): Promise<void> {
  if (!env.WORKFLOW) return;

  // Yeni istifadəçi qeydiyyatdan keçdikdə Cloudflare Workflow başladılır
  await env.WORKFLOW.create({
    id: `welcome-${event.userId}`,
    params: {
      type: 'WelcomeWorkflow',
      userId: event.userId,
      email: event.email
    }
  });
}
