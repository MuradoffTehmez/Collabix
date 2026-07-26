// Komanda XP dəyərləri — PDR "Team XP" bölməsi.
export const TEAM_XP = {
  TASK_COMPLETED: 20,
  BUG_FIXED: 30,
  PROJECT_FINISHED: 100,
  HACKATHON_WINNER: 500,
  MEMBER_JOINED: 5,
  FILE_UPLOADED: 2,
  POST_CREATED: 1,
} as const;

/** Tapşırıq "bug" kimi işarələnibsə daha çox XP verilir. */
export function taskXpFor(task: { title?: string; description?: string; priority?: string } | null): number {
  if (!task) return TEAM_XP.TASK_COMPLETED;
  const hay = `${task.title || ''} ${task.description || ''}`.toLowerCase();
  if (/\b(bug|fix|hotfix|xəta|səhv)\b/.test(hay)) return TEAM_XP.BUG_FIXED;
  return TEAM_XP.TASK_COMPLETED;
}

/** İstifadəçinin şəxsi XP-si — TASK-7 qərarı ilə tapşırıq başına +50. */
export const USER_TASK_XP = 50;
