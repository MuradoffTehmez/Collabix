// `routes.ts` — BARREL + bildiriş endpointləri.
//
// 🔴 AUDIT-TASK-10 / Faza 3.1 TAMAMLANDI (audit struktur borcu #1).
//
// ƏVVƏL: 189 644 bayt (185 KB), 120 export, 3 772 sətir — audit onu
// "ən böyük borc" adlandırırdı: hər dəyişiklik bütün faylı toxundururdu,
// merge konflikti riski və koqnitiv yük yaradırdı.
//
// İNDİ: domen modulları `worker/routes/` altındadır, bu fayl isə əsasən
// RE-EXPORT barrel-idir. `index.ts` marşrut cədvəli `R.<ad>` formasını
// işlədir, ona görə barrel sayəsində o, BİR SƏTİR belə dəyişmədi
// (sənədin tələb etdiyi naxış — §3.1/4).
//
// ⚠ NİYƏ BİLDİRİŞLƏR HƏLƏ BURADADIR: cəmi üç kiçik endpoint və onlar heç bir
//   domen köməkçisi tələb etmir. Ayrıca modul fayl sayını artırardı, oxunuşu
//   yaxşılaşdırmazdı.
import { Ctx, json } from './util';
import { D } from './routes/shared';

export type { LogLevel } from './admin-log';

export async function listNotifs(c: Ctx) {
  const rows = await D(c).prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 60',
  ).bind(c.user!.id).all<any>();
  return json({
    notifications: rows.results.map(r => ({
      id: r.id, type: r.type, fromUid: r.from_id, fromName: r.from_name,
      postId: r.post_id, text: r.text, read: !!r.read, createdAt: r.created_at,
    })),
  });
}
export async function readNotif(c: Ctx, id: string) {
  await D(c).prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').bind(id, c.user!.id).run();
  return json({ ok: true });
}
export async function readAllNotifs(c: Ctx) {
  await D(c).prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(c.user!.id).run();
  return json({ ok: true });
}

/* ================= UPLOAD — `routes/upload.ts`-ə köçürüldü ================= */
// AUDIT-TASK-10 / Faza 3.1. `index.ts` marşrut cədvəli `R.upload` /
// `R.serveFile` adlarını işlədir, ona görə burada RE-EXPORT saxlanılır —
// belədə bölünmə `index.ts`-ə TOXUNMUR (sənədin tələb etdiyi barrel naxışı).
export { upload, serveFile } from './routes/upload';


/* ============ AUTH / 2FA / MAGIC LINK / OAUTH — `routes/auth.ts`-ə köçürüldü ============ */
// AUDIT-TASK-10 / Faza 3.1. `index.ts` marşrut cədvəli bu adları işlədir,
// ona görə RE-EXPORT saxlanılır — bölünmə `index.ts`-ə TOXUNMUR.
export {
  register, login, refresh, logout, me, listSessions, revokeOneSession,
  revokeOtherSessions, usernameAvailable, changePassword, changeUsername,
  deleteAccount,
} from './routes/auth';
export {
  mfaStatus, mfaSetup, mfaConfirm, mfaDisable, mfaRegenerateBackup, mfaVerify,
  magicLinkRequest, magicLinkConsume,
  oauthStart, oauthCallback, oauthPending, listOAuthAccounts, unlinkOAuth,
} from './routes/auth-methods';


/* ================= ADMIN — `routes/admin.ts`-ə köçürüldü ================= */
// AUDIT-TASK-10 / Faza 3.1 — `index.ts` marşrut cədvəli üçün RE-EXPORT.
export {
  listTaxonomies, saveTaxItem, deactivateTaxItem, reorderTaxonomy,
  adminUsersList, adminPatchUser, adminTempPassword, adminBulkUsers,
  adminStatsDaily, adminLogs, adminLogAction, adminExportCsv,
  adminListFaqs, adminSaveFaq, adminDeleteFaq,
  adminListTestimonials, adminSaveTestimonial, adminDeleteTestimonial,
  adminContacts, adminContactRead,
  adminListAdmins, adminAddAdmin, adminRemoveAdmin,
  securityEvents, securitySummary,
} from './routes/admin';


/* ================= POSTS / COMMENTS — `routes/post.ts`-ə köçürüldü ================= */
// AUDIT-TASK-10 / Faza 3.1 — `index.ts` marşrut cədvəli üçün RE-EXPORT.
export {
  feed, getPost, createPost, patchPost, deletePost, toggleRepost,
  likePut, likeDelete, bookmarkPut, bookmarkDelete,
  listComments, addComment, editComment, deleteComment,
  commentLikePut, commentLikeDelete,
} from './routes/post';

export {
  listUsers, usersDirectory, patchMe, patchSettings, mySocial,
  followLists, followPut, followDelete, progressOf, userStats, activityFor,
} from './routes/user';
export {
  listRooms, createRoom, deleteRoom, roomMessages, sendRoomMessage,
  editRoomMessage, deleteRoomMessage, listThreads, dmMessages, sendDM,
  editDM, deleteDMMsg, markThreadRead, heartbeat, presenceMap,
} from './routes/room';
export {
  listTasks, createTask, reviewTask, deleteTask, submitSolution,
  listSubmissions, reviewSubmission, createReport, listReports, resolveReport,
} from './routes/task';
export { exportMyData } from './routes/export';
export { globalSearch } from './routes/search';
export {
  publicFaqs, publicTestimonials, publicStats, publicGetPost, publicGetUser,
  newsletterSubscribe, contactSubmit, publicConfig, health,
} from './routes/public';
export {
  warnUser, listWarnings, banUser, muteUser, restoreUser, moderationStatus,
  listRoles, setUserRole, setUserPermission, myPermissions,
} from './routes/moderation';
