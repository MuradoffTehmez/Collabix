import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { Env } from '../util';

// ⚠ `DigestWorkflow` BU SİYAHIDAN ÇIXARILDI — AUDIT-TASK-10 / Faza 3.3.
//   Onu yaradan yeganə fayl (`workflows/daily_digest.ts`) heç yerdən
//   çağırılmırdı, `runDigest` isə yalnız `console.log` edirdi. Yəni tip
//   birləşməsində "gündəlik xülasə var" görünürdü, halbuki heç bir yol ona
//   çatmırdı. Boş dal saxlamaqdansa silinir; niyyət `docs/ARCHITECTURE.md`-də
//   qeydə alınıb.
export type WorkflowParams =
  | { type: 'WelcomeWorkflow'; userId: string; email: string }
  | { type: 'TeamOnboardingWorkflow'; teamId: string; ownerId: string };

export class CollabixWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const params = event.payload;

    switch (params.type) {
      case 'WelcomeWorkflow':
        await this.runWelcome(params, step);
        break;
      case 'TeamOnboardingWorkflow':
        // Əvvəl bu `case` ÜMUMİYYƏTLƏ yox idi — workflow yaradılırdı, amma
        // heç bir addım icra olunmurdu (bax docs/TASK-11-REPORT.md §2.2).
        await this.runTeamOnboarding(params, step);
        break;
    }
  }

  /**
   * Yeni istifadəçinin ilk günləri — AUDIT-TASK-10 / Faza 3.3 (B2 "doldur").
   *
   * ⚠ ƏVVƏLKİ VƏZİYYƏT: bu workflow REAL YARADILIRDI (`queue.ts` →
   *   `processUserRegistered`), 1 gün gözləyirdi və sonra yalnız
   *   `console.log('Sending followup email…')` edirdi. Yəni istifadəçi
   *   heç nə almırdı — `runTeamOnboarding`-in TASK-11-də düzəldilən
   *   qüsurunun eyni sinfi.
   *
   * ⚠ E-POÇT DEYİL, TƏTBİQDAXİLİ BİLDİRİŞ göndərilir. Səbəb: e-poçt yolu
   *   `EMAIL` binding-inə bağlıdır və qurulmayan quraşdırmada SƏSSİZCƏ heç nə
   *   etməzdi — yəni illüziyanı yenidən qurardıq. Bildiriş yolu isə həmişə
   *   işləyir və `runTeamOnboarding`-də artıq sınaqdan çıxıb.
   *
   * Hər addım istifadəçinin REAL vəziyyətini yoxlayır: fəal istifadəçiyə
   * xatırlatma getmir.
   */
  private async runWelcome(params: Extract<WorkflowParams, { type: 'WelcomeWorkflow' }>, step: WorkflowStep) {
    const { userId } = params;

    await step.sleep('wait-before-first-post-nudge', '1 days');

    await step.do('nudge-first-post', async () => {
      const row = await this.env.DB
        .prepare('SELECT COUNT(*) AS c FROM posts WHERE author_id = ?')
        .bind(userId).first<any>();
      if (Number(row?.c || 0) > 0) return;
      await this.notifyUser(userId, 'onboarding',
        'İlk paylaşımını et — icma səni məhz belə tanıyır.');
    });

    await step.sleep('wait-before-profile-nudge', '2 days');

    await step.do('nudge-profile', async () => {
      const u = await this.env.DB
        .prepare('SELECT bio, photo_url FROM users WHERE id = ?')
        .bind(userId).first<any>();
      if (!u) return;   // hesab silinib
      if (String(u.bio || '').trim() && u.photo_url) return;
      await this.notifyUser(userId, 'onboarding',
        'Profilini tamamla: qısa bio və şəkil əlavə et — profilin daha çox baxılır.');
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
    await this.notifyUser(ownerId, type, text, String(team.name));
  }

  /**
   * Sistem bildirişi — `from_id` BOŞDUR, yəni göndərən istifadəçi yoxdur.
   *
   * ⚠ `NotificationService.notify()` İŞLƏDİLMİR: o, `toUid === fromId`
   *   yoxlamasına və istifadəçi tərcihlərinə baxır. Onboarding xatırlatması
   *   isə sistemdəndir və `like/comment/follow` tərcih açarlarının heç birinə
   *   uyğun gəlmir — həmin yoldan keçsəydi qaydalar səhv tətbiq olunardı.
   */
  private async notifyUser(uid: string, type: string, text: string, fromName = 'Collabix') {
    const { NotificationService } = await import('../services/notification');
    // ⚠ Taksonomiya BURADA DA tətbiq olunur (miqrasiya 0049). Bu yol servisin
    //   `notify()`-ını atlayır, ona görə `group_key`/`priority` sütunlarını
    //   özü doldurmalıdır — əks halda sistem bildirişləri qruplaşdırma və
    //   prioritet filtrindən KƏNARDA qalardı (NULL açar heç bir qrupa düşmür).
    const { groupKeyFor, priorityOf } = await import('../services/notification/taxonomy');
    const notif = new NotificationService(this.env);
    await this.env.DB.prepare(
      `INSERT INTO notifications
         (id, user_id, type, from_id, from_name, post_id, text, read, created_at, archived, priority, group_key)
       VALUES (?,?,?,?,?,?,?,0,?,0,?,?)`,
    ).bind(
      crypto.randomUUID().replace(/-/g, ''), uid, type, '', fromName, null, text, Date.now(),
      priorityOf(type), groupKeyFor(type, '', null),
    ).run();
    await notif.pushSignal(uid, { t: 'notif' });
  }
}
