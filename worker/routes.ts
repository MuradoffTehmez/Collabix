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
// ⚠ BİLDİRİŞLƏR ARTIQ BURADA DEYİL — `routes/notification.ts`-ə köçürüldü.
//   Əvvəlki şərh "cəmi üç kiçik endpoint" deyirdi və bu, o vaxt doğru idi.
//   Bildiriş mərkəzi (miqrasiya 0049) arxiv, sabitləmə, prioritet,
//   qruplaşdırma və susdurma gətirdi — səbəb qüvvədən düşdü.
export type { LogLevel } from './admin-log';

/* ================= BİLDİRİŞLƏR — `routes/notification.ts`-ə köçürüldü ================= */
// `index.ts` marşrut cədvəli `R.listNotifs` / `R.readNotif` / `R.readAllNotifs`
// adlarını işlədir, ona görə burada RE-EXPORT saxlanılır — bölünmə mövcud
// marşrutlara TOXUNMUR (upload/auth ilə eyni barrel naxışı).
export {
  listNotifs, readNotif, readAllNotifs,
  notifStats, notifPreviews, deleteNotif, bulkNotifs, listMutes, toggleMute,
} from './routes/notification';

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
  passwordResetRequest, passwordResetConfirm,
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
  commentReactionPut, commentReactionDelete,
  commentPin, commentUnpin, commentHide, commentRestore, commentReport,
  postReactionPut, postReactionDelete,
  postPin, postUnpin, postHide, postRestore, postReport,
  pollVote,
} from './routes/post';

export {
  listUsers, patchMe, patchSettings, mySocial,
  followLists, followPut, followDelete, progressOf, userStats, activityFor,
} from './routes/user';
/* İstifadəçi kataloqu — `routes/user.ts`-dən ayrıldı (öz filtr taksonomiyası,
   sosial zənginləşdirməsi, tövsiyə və ixracı var). `index.ts` marşrut cədvəli
   `R.usersDirectory` adını işlədir, ona görə RE-EXPORT saxlanılır. */
export {
  usersDirectory, suggestedUsers, directoryStats, exportDirectory, publicProfile,
} from './routes/directory';
/* Profil domeni — kataloqdan AYRI (biri çox istifadəçinin az sahəsini, digəri
   bir istifadəçinin çox sahəsini oxuyur; bax `routes/profile.ts` başlığı). */
export {
  profileOverview, profileTimeline, recordProfileView, toggleProfilePin,
} from './routes/profile';
/* İş sahəsi (Tapşırıqlar) — istifadəçinin BÜTÜN komandalarındakı tapşırıqlar.
   ⚠ Üç fayla bölünüb: oxu / mutasiya / alt-resurs. Görünürlük qapısı
     (`scopedWhere`) birincidədir və hər üçü ondan qidalanır. */
export { wsTasks, wsStats, wsTrend, wsMeta } from './routes/workspace';
export { wsCreate, wsUpdate, wsBulk, wsMove, wsDetail } from './routes/workspace-task';
export {
  wsCheckAdd, wsCheckPatch, wsCheckDelete,
  wsCommentAdd, wsCommentPatch, wsCommentDelete,
  wsDepAdd, wsDepDelete, wsWatch,
  wsTimerStart, wsTimerStop, wsTimeAdd, wsTimerActive,
  wsLabelCreate, wsLabelDelete, wsLabelToggle,
  wsSprintCreate, wsSprintPatch, wsSprintDelete,
  wsViewSave, wsViewDelete,
  wsAutomationList, wsAutomationCreate, wsAutomationDelete,
} from './routes/workspace-sub';
export {
  listRooms, createRoom, deleteRoom, patchRoom, roomMessages, sendRoomMessage,
  editRoomMessage, deleteRoomMessage, listThreads, dmMessages, sendDM,
  editDM, deleteDMMsg, markThreadRead, heartbeat, presenceMap,
  // Sabitlənmiş mesajlar (0046)
  listRoomPins, pinRoomMessage, unpinRoomMessage,
  listDMPins, pinDMMessage, unpinDMMessage,
  // Reaksiya · əlfəcin · forward (0047)
  roomReactionPut, roomReactionDelete, dmReactionPut, dmReactionDelete,
  roomBookmarkPut, roomBookmarkDelete, dmBookmarkPut, dmBookmarkDelete,
  forwardMessage,
} from './routes/room';
export { linkPreview, linkImage } from './link-preview';
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
// Moderator namizədliyi — PRD §12 (ayrı modul: moderasiya CƏZA verir,
// namizədlik isə SƏLAHİYYƏT verir — iki fərqli iş axını).
export {
  myModeratorEligibility, applyForModerator, withdrawModeratorApplication,
  listModeratorApplications, reviewModeratorApplication,
} from './routes/mod-application';
// Dəvət axını — PRD §6-nın son açıq bəndi ("Dost dəvəti +50").
export {
  myInvites, createInvite, revokeInvite, checkInvite, adminInviteStats,
} from './routes/invite';
