import { Env } from '../util';
import { EventPayload } from '../events';

export async function processDailyDigest(env: Env, event: EventPayload<any>): Promise<void> {
  if (!env.WORKFLOW) return;
  await env.WORKFLOW.create({
    id: `digest-${event.type}-${Date.now()}`,
    params: { type: 'DigestWorkflow' }
  });
}
