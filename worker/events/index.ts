export type SystemEvent =
  | { type: 'UserRegistered'; userId: string; username: string; email: string }
  | { type: 'UserVerified'; userId: string }
  | { type: 'PostCreated'; postId: string; authorId: string; authorName: string; text: string }
  | { type: 'CommentCreated'; commentId: string; postId: string; authorId: string }
  | { type: 'TaskCompleted'; taskId: string; userId: string }
  | { type: 'ContestStarted'; contestId: string }
  | { type: 'ContestFinished'; contestId: string }
  | { type: 'AchievementUnlocked'; userId: string; badgeId: string }
  | { type: 'GeneratePDF'; url: string; targetUserId: string; filename: string }
  | { type: 'GenerateCertificate'; userId: string; courseId: string }
  | { type: 'PortfolioExported'; userId: string }
  // Legacy queue tasks converted to events
  | { type: 'MentionFanout'; fromId: string; fromName: string; text: string; label: string; postId: string | null }
  | { type: 'ArchiveSweep' }
  // Team Workspace events (TASK-11)
  | { type: 'TeamCreated'; teamId: string; ownerId: string }
  | { type: 'TeamUpdated'; teamId: string; userId: string }
  | { type: 'TeamDeleted'; teamId: string; userId: string }
  | { type: 'MemberJoined'; teamId: string; userId: string; roleId: string }
  | { type: 'MemberLeft'; teamId: string; userId: string }
  | { type: 'RoleChanged'; teamId: string; userId: string; roleId: string }
  | { type: 'ProjectCreated'; teamId: string; projectId: string; createdBy: string }
  | { type: 'ProjectCompleted'; teamId: string; projectId: string; completedBy: string; xp: number }
  | { type: 'ProjectDeleted'; teamId: string; projectId: string; userId: string }
  | { type: 'TaskAssigned'; teamId: string; taskId: string; assigneeId: string }
  | { type: 'TeamTaskCompleted'; teamId: string; taskId: string; completedBy: string }
  | { type: 'TeamPostCreated'; teamId: string; postId: string; authorId: string }
  | { type: 'FileUploaded'; teamId: string; fileId: string; uploadedBy: string }
  | {
      type: 'InvitationSent';
      teamId: string; inviteId: string; email: string;
      invitedBy: string; userId?: string;
    };

/** Aktivlik jurnalına yazılan komanda event-ləri. */
export const TEAM_EVENT_TYPES = [
  'TeamCreated', 'TeamUpdated', 'TeamDeleted',
  'MemberJoined', 'MemberLeft', 'RoleChanged',
  'ProjectCreated', 'ProjectCompleted', 'ProjectDeleted',
  'TaskAssigned', 'TeamTaskCompleted',
  'TeamPostCreated', 'FileUploaded', 'InvitationSent',
] as const;

export type TeamEventType = (typeof TEAM_EVENT_TYPES)[number];

export const isTeamEvent = (t: string): t is TeamEventType =>
  (TEAM_EVENT_TYPES as readonly string[]).includes(t);

export type EventPayload<T extends SystemEvent['type']> = Extract<SystemEvent, { type: T }>;
