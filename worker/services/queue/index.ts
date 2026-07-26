import { Env } from '../../util';
import { SystemEvent } from '../../events';
import { runTask } from '../../queue'; // For graceful degradation

export class QueueService {
  constructor(private env: Env) {}

  /**
   * Publishes an event to the Event Bus (Cloudflare Queue).
   * If the queue is not configured, runs the event synchronously (graceful degradation).
   */
  async publish(event: SystemEvent): Promise<void> {
    if (this.env.TASKS) {
      try {
        await this.env.TASKS.send(event);
        return;
      } catch (e: any) {
        console.error('Failed to publish event to queue, running synchronously:', event.type, e?.message || e);
      }
    }
    // Fallback to synchronous execution
    await runTask(this.env, event);
  }
}
