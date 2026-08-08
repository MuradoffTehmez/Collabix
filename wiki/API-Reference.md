# 📡 API Sənədləri (API Reference)

Bu sənəddə layihədəki bütün API endpointlərinin siyahısı və icraçıları göstərilir. `worker/index.ts` faylından avtomatik çıxarılmışdır.

| HTTP Metodu | Yol (Path) | İcraçı (Handler) |
|---|---|---|
| `POST` | `/api/auth/register` | R.register |
| `POST` | `/api/auth/login` | R.login |
| `POST` | `/api/auth/logout` | R.logout |
| `POST` | `/api/auth/refresh` | R.refresh |
| `GET` | `/api/auth/me` | R.me |
| `POST` | `/api/auth/mfa` | R.mfaVerify |
| `GET` | `/api/me/mfa` | R.mfaStatus |
| `POST` | `/api/me/mfa/setup` | R.mfaSetup |
| `POST` | `/api/me/mfa/confirm` | R.mfaConfirm |
| `POST` | `/api/me/mfa/backup-codes` | R.mfaRegenerateBackup |
| `DELETE` | `/api/me/mfa` | R.mfaDisable |
| `POST` | `/api/auth/magic-link` | R.magicLinkRequest |
| `GET` | `/api/auth/magic/([\w-]+)` | R.magicLinkConsume |
| `POST` | `/api/auth/password-reset` | R.passwordResetRequest |
| `POST` | `/api/auth/password-reset/confirm` | R.passwordResetConfirm |
| `GET` | `/api/auth/oauth/(github|google|linkedin)/start` | R.oauthStart |
| `GET` | `/api/auth/oauth/(github|google|linkedin)/callback` | R.oauthCallback |
| `GET` | `/api/auth/oauth/pending` | R.oauthPending |
| `GET` | `/api/me/oauth` | R.listOAuthAccounts |
| `DELETE` | `/api/me/oauth/(github|google|linkedin)` | R.unlinkOAuth |
| `GET` | `/api/auth/sessions` | R.listSessions |
| `DELETE` | `/api/auth/sessions/others` | R.revokeOtherSessions |
| `DELETE` | `/api/auth/sessions/([\w-]+)` | R.revokeOneSession |
| `GET` | `/api/auth/username-available` | R.usernameAvailable |
| `POST` | `/api/auth/change-password` | R.changePassword |
| `POST` | `/api/auth/change-username` | R.changeUsername |
| `DELETE` | `/api/auth/account` | R.deleteAccount |
| `GET` | `/api/search` | R.globalSearch |
| `GET` | `/api/users/([\w.]+)/stats` | R.userStats |
| `GET` | `/api/users/([\w.]+)/activity` | R.activityFor |
| `GET` | `/api/me/export` | R.exportMyData |
| `GET` | `/api/users` | R.listUsers |
| `GET` | `/api/users/directory` | R.usersDirectory |
| `GET` | `/api/users/suggested` | R.suggestedUsers |
| `GET` | `/api/users/dir-stats` | R.directoryStats |
| `GET` | `/api/users/export\.csv` | R.exportDirectory |
| `PATCH` | `/api/me` | R.patchMe |
| `PATCH` | `/api/me/settings` | R.patchSettings |
| `GET` | `/api/me/social` | R.mySocial |
| `GET` | `/api/users/([\w.]+)/profile` | R.publicProfile |
| `GET` | `/api/users/([\w.]+)/overview` | R.profileOverview |
| `GET` | `/api/users/([\w.]+)/timeline` | R.profileTimeline |
| `POST` | `/api/users/([\w.]+)/view` | R.recordProfileView |
| `GET` | `/api/users/([\w-]+)/follow-lists` | R.followLists |
| `GET` | `/api/users/([\w-]+)/progress` | R.progressOf |
| `PUT` | `/api/follows/([\w-]+)` | R.followPut |
| `DELETE` | `/api/follows/([\w-]+)` | R.followDelete |
| `PUT` | `/api/bookmarks/([\w-]+)` | R.bookmarkPut |
| `DELETE` | `/api/bookmarks/([\w-]+)` | R.bookmarkDelete |
| `GET` | `/api/feed` | R.feed |
| `GET` | `/api/posts/([\w-]+)` | R.getPost |
| `POST` | `/api/posts` | R.createPost |
| `PATCH` | `/api/posts/([\w-]+)` | R.patchPost |
| `DELETE` | `/api/posts/([\w-]+)` | R.deletePost |
| `POST` | `/api/posts/([\w-]+)/repost` | R.toggleRepost |
| `PUT` | `/api/posts/([\w-]+)/like` | R.likePut |
| `DELETE` | `/api/posts/([\w-]+)/like` | R.likeDelete |
| `GET` | `/api/posts/([\w-]+)/comments` | R.listComments |
| `POST` | `/api/posts/([\w-]+)/comments` | R.addComment |
| `PATCH` | `/api/posts/([\w-]+)/comments/([\w-]+)` | R.editComment |
| `DELETE` | `/api/posts/([\w-]+)/comments/([\w-]+)` | R.deleteComment |
| `PUT` | `/api/posts/([\w-]+)/comments/([\w-]+)/like` | R.commentLikePut |
| `DELETE` | `/api/posts/([\w-]+)/comments/([\w-]+)/like` | R.commentLikeDelete |
| `PUT` | `/api/posts/([\w-]+)/comments/([\w-]+)/reaction` | R.commentReactionPut |
| `DELETE` | `/api/posts/([\w-]+)/comments/([\w-]+)/reaction` | R.commentReactionDelete |
| `PUT` | `/api/posts/([\w-]+)/comments/([\w-]+)/pin` | R.commentPin |
| `DELETE` | `/api/posts/([\w-]+)/comments/([\w-]+)/pin` | R.commentUnpin |
| `PUT` | `/api/posts/([\w-]+)/comments/([\w-]+)/hide` | R.commentHide |
| `DELETE` | `/api/posts/([\w-]+)/comments/([\w-]+)/hide` | R.commentRestore |
| `POST` | `/api/posts/([\w-]+)/comments/([\w-]+)/report` | R.commentReport |
| `PUT` | `/api/posts/([\w-]+)/reaction` | R.postReactionPut |
| `DELETE` | `/api/posts/([\w-]+)/reaction` | R.postReactionDelete |
| `PUT` | `/api/posts/([\w-]+)/pin` | R.postPin |
| `DELETE` | `/api/posts/([\w-]+)/pin` | R.postUnpin |
| `POST` | `/api/posts/([\w-]+)/profile-pin` | R.toggleProfilePin |
| `GET` | `/api/ws/tasks` | R.wsTasks |
| `GET` | `/api/ws/stats` | R.wsStats |
| `GET` | `/api/ws/trend` | R.wsTrend |
| `GET` | `/api/ws/meta` | R.wsMeta |
| `GET` | `/api/ws/timer` | R.wsTimerActive |
| `GET` | `/api/ws/automations` | R.wsAutomationList |
| `POST` | `/api/ws/tasks` | R.wsCreate |
| `POST` | `/api/ws/bulk` | R.wsBulk |
| `POST` | `/api/ws/labels` | R.wsLabelCreate |
| `DELETE` | `/api/ws/labels/([\w-]+)` | R.wsLabelDelete |
| `POST` | `/api/ws/sprints` | R.wsSprintCreate |
| `PATCH` | `/api/ws/sprints/([\w-]+)` | R.wsSprintPatch |
| `DELETE` | `/api/ws/sprints/([\w-]+)` | R.wsSprintDelete |
| `POST` | `/api/ws/views` | R.wsViewSave |
| `DELETE` | `/api/ws/views/([\w-]+)` | R.wsViewDelete |
| `POST` | `/api/ws/automations` | R.wsAutomationCreate |
| `DELETE` | `/api/ws/automations/([\w-]+)` | R.wsAutomationDelete |
| `GET` | `/api/ws/tasks/([\w-]+)` | R.wsDetail |
| `PATCH` | `/api/ws/tasks/([\w-]+)` | R.wsUpdate |
| `POST` | `/api/ws/tasks/([\w-]+)/move` | R.wsMove |
| `POST` | `/api/ws/tasks/([\w-]+)/watch` | R.wsWatch |
| `POST` | `/api/ws/tasks/([\w-]+)/labels` | R.wsLabelToggle |
| `POST` | `/api/ws/tasks/([\w-]+)/checklist` | R.wsCheckAdd |
| `PATCH` | `/api/ws/tasks/([\w-]+)/checklist/([\w-]+)` | R.wsCheckPatch |
| `DELETE` | `/api/ws/tasks/([\w-]+)/checklist/([\w-]+)` | R.wsCheckDelete |
| `POST` | `/api/ws/tasks/([\w-]+)/comments` | R.wsCommentAdd |
| `PATCH` | `/api/ws/tasks/([\w-]+)/comments/([\w-]+)` | R.wsCommentPatch |
| `DELETE` | `/api/ws/tasks/([\w-]+)/comments/([\w-]+)` | R.wsCommentDelete |
| `POST` | `/api/ws/tasks/([\w-]+)/deps` | R.wsDepAdd |
| `DELETE` | `/api/ws/tasks/([\w-]+)/deps/([\w-]+)` | R.wsDepDelete |
| `POST` | `/api/ws/tasks/([\w-]+)/timer/start` | R.wsTimerStart |
| `POST` | `/api/ws/tasks/([\w-]+)/timer/stop` | R.wsTimerStop |
| `POST` | `/api/ws/tasks/([\w-]+)/time` | R.wsTimeAdd |
| `DELETE` | `/api/ws/tasks/([\w-]+)/attachments/([\w-]+)` | R.wsAttachDelete |
| `PUT` | `/api/posts/([\w-]+)/hide` | R.postHide |
| `DELETE` | `/api/posts/([\w-]+)/hide` | R.postRestore |
| `POST` | `/api/posts/([\w-]+)/report` | R.postReport |
| `POST` | `/api/posts/([\w-]+)/poll/vote` | R.pollVote |
| `GET` | `/api/rooms` | R.listRooms |
| `POST` | `/api/rooms` | R.createRoom |
| `DELETE` | `/api/rooms/([\w-]+)` | R.deleteRoom |
| `PATCH` | `/api/rooms/([\w-]+)` | R.patchRoom |
| `GET` | `/api/rooms/([\w-]+)/messages` | R.roomMessages |
| `POST` | `/api/rooms/([\w-]+)/messages` | R.sendRoomMessage |
| `PATCH` | `/api/rooms/([\w-]+)/messages/([\w-]+)` | R.editRoomMessage |
| `DELETE` | `/api/rooms/([\w-]+)/messages/([\w-]+)` | R.deleteRoomMessage |
| `GET` | `/api/rooms/([\w-]+)/pins` | R.listRoomPins |
| `PUT` | `/api/rooms/([\w-]+)/messages/([\w-]+)/pin` | R.pinRoomMessage |
| `DELETE` | `/api/rooms/([\w-]+)/messages/([\w-]+)/pin` | R.unpinRoomMessage |
| `PUT` | `/api/rooms/([\w-]+)/messages/([\w-]+)/reaction` | R.roomReactionPut |
| `DELETE` | `/api/rooms/([\w-]+)/messages/([\w-]+)/reaction` | R.roomReactionDelete |
| `PUT` | `/api/rooms/([\w-]+)/messages/([\w-]+)/bookmark` | R.roomBookmarkPut |
| `DELETE` | `/api/rooms/([\w-]+)/messages/([\w-]+)/bookmark` | R.roomBookmarkDelete |
| `GET` | `/api/dms` | R.listThreads |
| `GET` | `/api/dms/([\w_-]+)/messages` | R.dmMessages |
| `POST` | `/api/dms/to/([\w-]+)` | R.sendDM |
| `PATCH` | `/api/dms/([\w_-]+)/messages/([\w-]+)` | R.editDM |
| `DELETE` | `/api/dms/([\w_-]+)/messages/([\w-]+)` | R.deleteDMMsg |
| `POST` | `/api/dms/([\w_-]+)/read` | R.markThreadRead |
| `GET` | `/api/dms/([\w_-]+)/pins` | R.listDMPins |
| `PUT` | `/api/dms/([\w_-]+)/messages/([\w-]+)/pin` | R.pinDMMessage |
| `DELETE` | `/api/dms/([\w_-]+)/messages/([\w-]+)/pin` | R.unpinDMMessage |
| `PUT` | `/api/dms/([\w_-]+)/messages/([\w-]+)/reaction` | R.dmReactionPut |
| `DELETE` | `/api/dms/([\w_-]+)/messages/([\w-]+)/reaction` | R.dmReactionDelete |
| `PUT` | `/api/dms/([\w_-]+)/messages/([\w-]+)/bookmark` | R.dmBookmarkPut |
| `DELETE` | `/api/dms/([\w_-]+)/messages/([\w-]+)/bookmark` | R.dmBookmarkDelete |
| `POST` | `/api/messages/forward` | R.forwardMessage |
| `GET` | `/api/link-preview` | R.linkPreview |
| `GET` | `/api/link-image` | R.linkImage |
| `POST` | `/api/presence` | R.heartbeat |
| `GET` | `/api/presence` | R.presenceMap |
| `GET` | `/api/notifications` | R.listNotifs |
| `GET` | `/api/notifications/stats` | R.notifStats |
| `GET` | `/api/notifications/previews` | R.notifPreviews |
| `GET` | `/api/notifications/mutes` | R.listMutes |
| `POST` | `/api/notifications/mutes` | R.toggleMute |
| `POST` | `/api/notifications/read-all` | R.readAllNotifs |
| `POST` | `/api/notifications/bulk` | R.bulkNotifs |
| `POST` | `/api/notifications/([\w-]+)/read` | R.readNotif |
| `DELETE` | `/api/notifications/([\w-]+)` | R.deleteNotif |
| `GET` | `/api/tasks` | R.listTasks |
| `POST` | `/api/tasks` | R.createTask |
| `POST` | `/api/tasks/([\w-]+)/review` | R.reviewTask |
| `DELETE` | `/api/tasks/([\w-]+)` | R.deleteTask |
| `PUT` | `/api/tasks/([\w-]+)/submission` | R.submitSolution |
| `GET` | `/api/submissions` | R.listSubmissions |
| `POST` | `/api/submissions/([\w-]+)/([\w-]+)/review` | R.reviewSubmission |
| `POST` | `/api/reports` | R.createReport |
| `GET` | `/api/reports` | R.listReports |
| `PATCH` | `/api/reports/([\w-]+)` | R.resolveReport |
| `GET` | `/api/taxonomies` | R.listTaxonomies |
| `POST` | `/api/taxonomies/(prog|spoken)` | R.saveTaxItem |
| `DELETE` | `/api/taxonomies/(prog|spoken)/([\w-]+)` | R.deactivateTaxItem |
| `GET` | `/api/config` | R.publicConfig |
| `GET` | `/api/health` | R.health |
| `GET` | `/api/public/faqs` | R.publicFaqs |
| `GET` | `/api/public/testimonials` | R.publicTestimonials |
| `GET` | `/api/public/stats` | R.publicStats |
| `GET` | `/api/public/posts/([\w-]+)` | R.publicGetPost |
| `GET` | `/api/public/users/([\w.]+)` | R.publicGetUser |
| `POST` | `/api/public/newsletter` | R.newsletterSubscribe |
| `POST` | `/api/public/contact` | R.contactSubmit |
| `GET` | `/api/admin/faqs` | R.adminListFaqs |
| `POST` | `/api/admin/faqs` | R.adminSaveFaq |
| `DELETE` | `/api/admin/faqs/([\w-]+)` | R.adminDeleteFaq |
| `GET` | `/api/admin/testimonials` | R.adminListTestimonials |
| `POST` | `/api/admin/testimonials` | R.adminSaveTestimonial |
| `DELETE` | `/api/admin/testimonials/([\w-]+)` | R.adminDeleteTestimonial |
| `GET` | `/api/admin/contacts` | R.adminContacts |
| `POST` | `/api/admin/contacts/([\w-]+)/read` | R.adminContactRead |
| `PATCH` | `/api/admin/users/([\w-]+)` | R.adminPatchUser |
| `POST` | `/api/admin/users/([\w-]+)/temp-password` | R.adminTempPassword |
| `GET` | `/api/admin/admins` | R.adminListAdmins |
| `PUT` | `/api/admin/admins/([\w-]+)` | R.adminAddAdmin |
| `DELETE` | `/api/admin/admins/([\w-]+)` | R.adminRemoveAdmin |
| `GET` | `/api/admin/logs` | R.adminLogs |
| `GET` | `/api/admin/users` | R.adminUsersList |
| `POST` | `/api/admin/users/bulk` | R.adminBulkUsers |
| `GET` | `/api/me/permissions` | R.myPermissions |
| `GET` | `/api/roles` | R.listRoles |
| `PUT` | `/api/users/([\w-]+)/role` | R.setUserRole |
| `PUT` | `/api/users/([\w-]+)/permission` | R.setUserPermission |
| `GET` | `/api/users/([\w-]+)/moderation` | R.moderationStatus |
| `GET` | `/api/users/([\w-]+)/warnings` | R.listWarnings |
| `POST` | `/api/users/([\w-]+)/warn` | R.warnUser |
| `POST` | `/api/users/([\w-]+)/ban` | R.banUser |
| `POST` | `/api/users/([\w-]+)/mute` | R.muteUser |
| `POST` | `/api/users/([\w-]+)/restore` | R.restoreUser |
| `GET` | `/api/me/moderator-eligibility` | R.myModeratorEligibility |
| `POST` | `/api/me/moderator-application` | R.applyForModerator |
| `DELETE` | `/api/me/moderator-application` | R.withdrawModeratorApplication |
| `GET` | `/api/invites/([A-Za-z0-9]{1,16})/check` | R.checkInvite |
| `GET` | `/api/me/invites` | R.myInvites |
| `POST` | `/api/me/invites` | R.createInvite |
| `DELETE` | `/api/me/invites/([A-Za-z0-9]{1,16})` | R.revokeInvite |
| `GET` | `/api/admin/invite-stats` | R.adminInviteStats |
| `GET` | `/api/admin/moderator-applications` | R.listModeratorApplications |
| `POST` | `/api/admin/moderator-applications/([\w-]+)/review` | R.reviewModeratorApplication |
| `GET` | `/api/admin/stats-daily` | R.adminStatsDaily |
| `GET` | `/api/admin/teams` | async (c) => TR(c |
| `GET` | `/api/admin/teams/([\w-]+)` | async (c |
| `POST` | `/api/admin/teams/([\w-]+)/action` | async (c |
| `GET` | `/api/admin/export/(users|logs)\.csv` | R.adminExportCsv |
| `POST` | `/api/taxonomies/(prog|spoken)/reorder` | R.reorderTaxonomy |
| `POST` | `/api/admin/log` | R.adminLogAction |
| `GET` | `/api/admin/security/events` | R.securityEvents |
| `GET` | `/api/admin/security/summary` | R.securitySummary |
| `POST` | `/api/ai/chat` | handleChat |
| `GET` | `/api/search/semantic` | handleSearchSemantic |
| `GET` | `/api/teams` | async (c) => TR(c |
| `POST` | `/api/teams` | async (c) => TR(c |
| `GET` | `/api/teams/discover` | async (c) => TR(c |
| `GET` | `/api/teams/([\w-]+)` | async (c |
| `PATCH` | `/api/teams/([\w-]+)` | async (c |
| `DELETE` | `/api/teams/([\w-]+)` | async (c |
| `POST` | `/api/teams/([\w-]+)/join` | async (c |
| `POST` | `/api/teams/([\w-]+)/leave` | async (c |
| `POST` | `/api/teams/([\w-]+)/transfer` | async (c |
| `GET` | `/api/teams/([\w-]+)/search` | async (c |
| `GET` | `/api/teams/([\w-]+)/ai/summary` | async (c |
| `GET` | `/api/teams/([\w-]+)/members` | async (c |
| `PATCH` | `/api/teams/([\w-]+)/members/([\w-]+)` | async (c |
| `DELETE` | `/api/teams/([\w-]+)/members/([\w-]+)` | async (c |
| `GET` | `/api/teams/([\w-]+)/roles` | async (c |
| `POST` | `/api/teams/([\w-]+)/roles` | async (c |
| `PATCH` | `/api/teams/([\w-]+)/roles/([\w-]+)` | async (c |
| `DELETE` | `/api/teams/([\w-]+)/roles/([\w-]+)` | async (c |
| `GET` | `/api/invites` | async (c) => TR(c |
| `POST` | `/api/invites/([\w-]+)/accept` | async (c |
| `POST` | `/api/invites/([\w-]+)/decline` | async (c |
| `GET` | `/api/teams/([\w-]+)/invites` | async (c |
| `POST` | `/api/teams/([\w-]+)/invites` | async (c |
| `POST` | `/api/teams/([\w-]+)/invites/([\w-]+)/accept` | async (c |
| `DELETE` | `/api/teams/([\w-]+)/invites/([\w-]+)` | async (c |
| `GET` | `/api/teams/([\w-]+)/projects` | async (c |
| `POST` | `/api/teams/([\w-]+)/projects` | async (c |
| `PATCH` | `/api/teams/([\w-]+)/projects/([\w-]+)` | async (c |
| `DELETE` | `/api/teams/([\w-]+)/projects/([\w-]+)` | async (c |
| `POST` | `/api/teams/([\w-]+)/projects/([\w-]+)/join` | async (c |
| `GET` | `/api/teams/([\w-]+)/projects/([\w-]+)/requests` | async (c |
| `POST` | `/api/teams/([\w-]+)/projects/([\w-]+)/requests/([\w-]+)/approve` | async (c |
| `POST` | `/api/teams/([\w-]+)/projects/([\w-]+)/requests/([\w-]+)/reject` | async (c |
| `GET` | `/api/teams/([\w-]+)/tasks` | async (c |
| `POST` | `/api/teams/([\w-]+)/tasks` | async (c |
| `PATCH` | `/api/teams/([\w-]+)/tasks/([\w-]+)` | async (c |
| `DELETE` | `/api/teams/([\w-]+)/tasks/([\w-]+)` | async (c |
| `GET` | `/api/teams/([\w-]+)/files` | async (c |
| `POST` | `/api/teams/([\w-]+)/files` | async (c |
| `DELETE` | `/api/teams/([\w-]+)/files/([\w-]+)` | async (c |
| `GET` | `/api/teams/([\w-]+)/feed` | async (c |
| `POST` | `/api/teams/([\w-]+)/(?:feed|posts)` | async (c |
| `DELETE` | `/api/teams/([\w-]+)/(?:feed|posts)/([\w-]+)` | async (c |
| `GET` | `/api/teams/([\w-]+)/rooms` | async (c |
| `POST` | `/api/teams/([\w-]+)/rooms` | async (c |
| `DELETE` | `/api/teams/([\w-]+)/rooms/([\w-]+)` | async (c |
| `GET` | `/api/teams/([\w-]+)/activity` | async (c |
| `GET` | `/api/teams/([\w-]+)/stats` | async (c |
| `GET` | `/api/users/search` | async (c) => TR(c |
| `GET` | `/api/users/suggestions` | async (c) => TR(c |
| `POST` | `/api/upload` | R.upload |
