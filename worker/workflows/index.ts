import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { Env } from '../util';

export type WorkflowParams =
  | { type: 'WelcomeWorkflow'; userId: string; email: string }
  | { type: 'DigestWorkflow'; userId: string }
  | { type: 'TeamOnboardingWorkflow'; teamId: string; ownerId: string };

export class CollabixWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const params = event.payload;

    switch (params.type) {
      case 'WelcomeWorkflow':
        await this.runWelcome(params, step);
        break;
      case 'DigestWorkflow':
        await this.runDigest(params, step);
        break;
      case 'TeamOnboardingWorkflow':
        // Əvvəl bu `case` ÜMUMİYYƏTLƏ yox idi — workflow yaradılırdı, amma
        // heç bir addım icra olunmurdu (bax docs/TASK-11-REPORT.md §2.2).
        await this.runTeamOnboarding(params, step);
        break;
    }
  }

  private async runWelcome(params: Extract<WorkflowParams, { type: 'WelcomeWorkflow' }>, step: WorkflowStep) {
    await step.sleep('wait-1-day', '1 days');

    await step.do('send-followup-email', async () => {
      console.log(`Sending followup email to ${params.email}`);
    });
  }

  private async runDigest(params: Extract<WorkflowParams, { type: 'DigestWorkflow' }>, step: WorkflowStep) {
    await step.do('build-digest', async () => {
      console.log(`Building digest for ${params.userId}`);
    });
  }

  /**
   * PDR "Workflow": Team Created → Welcome → Setup → Invite Members →
   * First Project → First Task.
   *
   * Hər addım komandanın REAL vəziyyətini yoxlayır və yalnız çatışmayan
   * mərhələ üçün bildiriş göndərir — beləcə fəal komandaya lazımsız
   * xatırlatma getmir.
   */
  private async runTeamOnboarding(
    params: Extract<WorkflowParams, { type: 'TeamOnboardingWorkflow' }>,
    step: WorkflowStep,
  ) {
    const { teamId, ownerId } = params;

    await step.do('welcome', async () => {
      await this.notifyOwner(teamId, ownerId, 'team_onboarding',
        'Komandanız hazırdır! İlk addım: profil və görünürlük parametrləri.');
    });

    await step.sleep('wait-before-invite-nudge', '1 days');

    await step.do('nudge-invite-members', async () => {
      const row = await this.env.DB
        .prepare('SELECT COUNT(*) AS c FROM team_members WHERE team_id = ?')
        .bind(teamId).first<any>();
      if (Number(row?.c || 0) > 1) return;
      await this.notifyOwner(teamId, ownerId, 'team_onboarding',
        'Komandanıza hələ üzv dəvət etməmisiniz — birlikdə işləmək daha sürətlidir.');
    });

    await step.sleep('wait-before-project-nudge', '2 days');

    await step.do('nudge-first-project', async () => {
      const row = await this.env.DB
        .prepare("SELECT COUNT(*) AS c FROM team_projects WHERE team_id = ? AND status != 'deleted'")
        .bind(teamId).first<any>();
      if (Number(row?.c || 0) > 0) return;
      await this.notifyOwner(teamId, ownerId, 'team_onboarding',
        'İlk layihənizi yaradın — tapşırıqlar və fayllar layihə ətrafında qurulur.');
    });

    await step.sleep('wait-before-task-nudge', '2 days');

    await step.do('nudge-first-task', async () => {
      const row = await this.env.DB.prepare(
        `SELECT COUNT(*) AS c FROM team_tasks t JOIN team_projects p ON t.project_id = p.id
          WHERE p.team_id = ? AND t.status != 'Deleted'`
      ).bind(teamId).first<any>();
      if (Number(row?.c || 0) > 0) return;
      await this.notifyOwner(teamId, ownerId, 'team_onboarding',
        'İlk tapşırığı yaradın və komanda üzvünə təyin edin.');
    });
  }

  private async notifyOwner(teamId: string, ownerId: string, type: string, text: string) {
    const team = await this.env.DB.prepare("SELECT name FROM teams WHERE id = ? AND status = 'active'")
      .bind(teamId).first<any>();
    if (!team) return; // komanda silinibsə xatırlatma göndərmirik

    const { NotificationService } = await import('../services/notification');
    const notif = new NotificationService(this.env);
    await this.env.DB.prepare(
      'INSERT INTO notifications (id, user_id, type, from_id, from_name, post_id, text, read, created_at) VALUES (?,?,?,?,?,?,?,0,?)',
    ).bind(
      crypto.randomUUID().replace(/-/g, ''), ownerId, type, '', String(team.name), null, text, Date.now(),
    ).run();
    await notif.pushSignal(ownerId, { t: 'notif' });
  }
}
