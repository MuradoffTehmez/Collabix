import { Env } from '../util';
import { SystemEvent } from '../events';
import { TeamActivityService } from '../services/team/activity.service';
import { TeamService } from '../services/team/team.service';
import { TeamInviteService } from '../services/team/invite.service';
import { TEAM_XP } from '../services/team/xp';
import { sendEmail, teamInviteMail, mailLang, emailEnabled } from '../email';
import { processTeamOnboardingWorkflow } from '../workflows/team_onboarding';

/**
 * Komanda event-lərinin fon emalı (Cloudflare Queues → bu funksiya).
 *
 * Bir yerdə: aktivlik jurnalı, komanda XP-si, dəvət emaili və onboarding
 * workflow-un başladılması. Queue binding-i yoxdursa `QueueService` bunu
 * sinxron çağırır (graceful degradation).
 */
export async function processTeamEvent(env: Env, event: SystemEvent & { teamId: string }): Promise<void> {
  const ev = event as any;
  const activity = new TeamActivityService(env);
  const teams = new TeamService(env);

  const actorId =
    ev.ownerId || ev.userId || ev.createdBy || ev.completedBy ||
    ev.authorId || ev.uploadedBy || ev.invitedBy || ev.assigneeId || '';

  await activity.logEvent(ev.teamId, actorId, ev.type, ev);

  switch (ev.type) {
    case 'TeamCreated':
      // Onboarding workflow: Welcome → Setup → Invite → First Project → First Task.
      await processTeamOnboardingWorkflow(env, { teamId: ev.teamId, ownerId: ev.ownerId });
      break;

    case 'MemberJoined':
      await teams.addXp(ev.teamId, TEAM_XP.MEMBER_JOINED);
      break;

    case 'InvitationSent':
      await sendInviteEmail(env, ev);
      break;

    // Vectorize indeksi — semantik komanda axtarışı üçün (PDR "Vectorize").
    // Binding yoxdursa `TeamAIService` səssizcə keçir.
    case 'ProjectCreated':
      await indexProject(env, ev.teamId, ev.projectId);
      break;
    case 'TaskAssigned':
      await indexTask(env, ev.teamId, ev.taskId);
      break;
    case 'TeamPostCreated':
      await indexPost(env, ev.teamId, ev.postId);
      break;

    default:
      break;
  }
}

async function indexProject(env: Env, teamId: string, projectId: string) {
  const row = await env.DB.prepare('SELECT name, description FROM team_projects WHERE id = ?')
    .bind(projectId).first<any>();
  if (!row) return;
  const { TeamAIService } = await import('../services/team/ai.service');
  await new TeamAIService(env).indexTeamDocument(
    teamId, 'project', projectId, `${row.name}\n${row.description || ''}`,
  );
}

async function indexTask(env: Env, teamId: string, taskId: string) {
  const row = await env.DB.prepare('SELECT title, description FROM team_tasks WHERE id = ?')
    .bind(taskId).first<any>();
  if (!row) return;
  const { TeamAIService } = await import('../services/team/ai.service');
  await new TeamAIService(env).indexTeamDocument(
    teamId, 'task', taskId, `${row.title}\n${row.description || ''}`,
  );
}

async function indexPost(env: Env, teamId: string, postId: string) {
  const row = await env.DB.prepare('SELECT content FROM team_posts WHERE id = ?')
    .bind(postId).first<any>();
  if (!row) return;
  const { TeamAIService } = await import('../services/team/ai.service');
  await new TeamAIService(env).indexTeamDocument(teamId, 'post', postId, String(row.content || ''));
}

async function sendInviteEmail(env: Env, ev: any) {
  if (!ev.email) return;
  if (!emailEnabled(env)) {
    console.log(`[queue] invite email atlandı (EMAIL binding yoxdur) → ${ev.email} / team ${ev.teamId}`);
    return;
  }

  const invite = await new TeamInviteService(env).getInvite(ev.inviteId);
  if (!invite || invite.status !== 'pending') return;

  const row = await env.DB.prepare(
    `SELECT t.name AS team_name, t.slug AS team_slug,
            u.name AS inviter_name, u.username AS inviter_username,
            r.name AS role_name
       FROM teams t
       LEFT JOIN users u ON u.id = ?
       LEFT JOIN team_roles r ON r.id = ?
      WHERE t.id = ?`
  ).bind(ev.invitedBy || '', invite.role_id || '', ev.teamId).first<any>();
  if (!row) return;

  // Dəvət linki "Dəvətlər" tabına düşür — istifadəçi orada qəbul/imtina edir.
  const base = String(env.APP_URL || 'https://collabix.site').replace(/\/+$/, '');
  const url = `${base}/#teams?scope=invites`;

  const mail = teamInviteMail(
    {
      teamName: String(row.team_name || 'Collabix'),
      inviterName: String(row.inviter_name || row.inviter_username || 'Collabix'),
      roleName: String(row.role_name || 'Developer'),
      url,
    },
    mailLang('az'),
  );
  await sendEmail(env, { ...mail, to: String(ev.email) });
}
