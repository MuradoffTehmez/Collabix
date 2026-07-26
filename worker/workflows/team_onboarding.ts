import { Env } from '../util';

/**
 * Komanda onboarding workflow-unu başladır.
 *
 * WORKFLOW binding-i yoxdursa (lokal dev, ya da hələ provision edilməyib)
 * səssizcə keçir — komanda yaradılması bundan asılı olmamalıdır.
 * Eyni id ilə təkrar çağırış `instance already exists` verir; bu, xəta deyil,
 * ona görə udulur (queue mesajı retry-a düşməsin).
 */
export async function processTeamOnboardingWorkflow(
  env: Env,
  event: { teamId: string; ownerId: string },
): Promise<void> {
  if (!env.WORKFLOW || !event?.teamId) return;

  try {
    await env.WORKFLOW.create({
      id: `team-onboarding-${event.teamId}`,
      params: {
        type: 'TeamOnboardingWorkflow',
        teamId: event.teamId,
        ownerId: event.ownerId,
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (!/already exists/i.test(msg)) {
      console.error('team onboarding workflow başlamadı:', msg);
    }
  }
}
