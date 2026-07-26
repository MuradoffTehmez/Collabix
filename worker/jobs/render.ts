import { Env } from '../util';
import { EventPayload } from '../events';
import { BrowserService } from '../services/browser';
import { NotificationService } from '../services/notification';

export async function processGeneratePDF(env: Env, event: EventPayload<'GeneratePDF'>): Promise<void> {
  const browserService = new BrowserService(env);
  const notificationService = new NotificationService(env);

  try {
    const pdfBuffer = await browserService.generatePDF(event.url);
    
    // pdfBuffer is just returned for now or can be logged
    console.log(`Rendered PDF of size: ${pdfBuffer.byteLength}`);
    // await env.R2_BUCKET.put(`renders/${event.targetUserId}/${event.filename}`, pdfBuffer);
    
    // Notify the user that the render is complete
    const notifyOk = await notificationService.notify(
      event.targetUserId,
      'system',
      'System',
      'render_complete',
      `Sizin PDF sənədiniz (${event.filename}) hazırdır.`
    );
    if (notifyOk) await notificationService.pushSignal(event.targetUserId, { t: 'notif' });

  } catch (error) {
    console.error('Error generating PDF:', error);
    // Notify about failure
    await notificationService.notify(
      event.targetUserId,
      'system',
      'System',
      'render_failed',
      `PDF sənədinin (${event.filename}) hazırlanması uğursuz oldu.`
    );
  }
}
