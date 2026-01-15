# Personal Assistant AI - Project Context

## NORTH STAR VISION

Build a **private, persistent AI operating system** for business and daily execution that:

1. **Ingests everything** - Gmail emails + threads + attachments, business documents (contracts, SOPs, pro formas), call transcripts, daily reports, notes/decisions
2. **Maintains live state** - Tasks, calendar, waiting-on list, active projects/deals/clients/vendors, key people + roles, and a "Current Truth" page representing what is currently true about the business
3. **Is always chat-available** - Answer questions grounded in stored data with source citations ("What did we decide?", "What does the contract say?", "What's blocking this?")
4. **Proposes and prepares execution** - Drafts emails/messages, prepares checklists, agendas, follow-ups. NEVER takes irreversible actions without approval
5. **Executes with approval gates** - Log what was suggested, what was approved, and what was done. Full auditability.

## CORE PRINCIPLES (NON-NEGOTIABLES)

- **Persistence**: Memory lives in the database (Supabase), not in chat. Claude is the reasoning layer.
- **Grounding**: Every answer/draft must reference sources (email/thread/document/transcript/date)
- **Approval Gates**: Suggestions and drafts require approval before execution (send email, create event, etc.)
- **Auditability**: Explicit audit_log table tracks all actions with previous/new state
- **Incremental Value**: Each loop delivers real, usable functionality

## TECH STACK

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + Radix UI
- **Database**: Supabase (PostgreSQL) - Cloud instance at qprhkeaeaaizkagyqrtc
- **Email**: Gmail API (OAuth 2.0)
- **AI**: OpenAI (gpt-4o-mini) or Anthropic (claude-3-5-sonnet) - configurable via AI_PROVIDER env var
- **Push Notifications**: Web Push API with VAPID keys
- **Deployment**: Vercel (LIVE)

## BUILD STRATEGY - INCREMENTAL LOOPS

### Loop 1 - COMPLETED
**Email → Task Suggestions → Approval → Tasks**
- Gmail integration fetches emails with "Work" label
- AI extracts actionable tasks with strict data contract
- Suggestions stored in `suggestions` table with status='pending'
- `/approvals` page for review/edit/approve/reject
- Approved suggestions become tasks in `tasks` table
- Full audit trail via foreign keys (task → suggestion → email)

### Loop 2 - COMPLETED
**Waiting-On + Follow-Up Engine**
- Thread aggregation from emails (grouped by Gmail thread_id)
- Waiting-on detection: I sent last message + no reply for 2+ days
- `/waiting-on` page showing stalled threads with days waiting
- `/review` page - unified approval queue (tasks + follow-ups)
- AI-generated follow-up email drafts
- Gmail send capability (approval-gated)
- Explicit `audit_log` table for all actions
- Snooze/resolve functionality for threads

### Loop 3 - COMPLETED
**Daily Brief + Push Notifications**
- Morning brief (7:00 AM Costa Rica): tasks due today, pending approvals, waiting-on threads
- Evening brief (8:00 PM Costa Rica): tasks completed, still pending, activity summary
- Real-time push notifications when new suggestions/waiting-on detected
- PWA support: installable on mobile (iOS/Android) and desktop (Chrome/Edge)
- Notification bell UI with unread count and dropdown
- `/api/cron/generate-brief` endpoint for scheduled briefs

### Loop 4 - PLANNED
**Calendar Read + Meeting Prep**
- Sync Google Calendar (read-only)
- Generate "prep packets" for meetings: related tasks, emails, suggested agenda

### Loop 5 - PLANNED
**Execution Helpers (Task Workbench)**
- Per-task AI actions: draft reply, create checklist, suggest next actions
- Still approval-gated

### Loop 6 - PLANNED
**Calendar Write (Controlled)**
- Propose calendar events
- Write to dedicated "AI Assistant" calendar after approval

### Loop 7 - PLANNED
**Knowledge Base + RAG**
- Ingest documents, transcripts, notes
- Chunk + embed for retrieval
- Chat with citations

### Loop 8 - PLANNED
**Current Truth Page**
- Structured source-of-truth: agreements, pricing, policies, templates
- Explicit approval for updates

### Loop 9 - PLANNED
**Long-term Intelligence**
- Weekly/monthly reflection on patterns, delays, risks

## DATABASE SCHEMA

### Core Tables (Loop 1)
- `people` - Email senders/recipients
- `emails` - Gmail messages (idempotent via gmail_message_id)
- `suggestions` - AI-generated task suggestions (pending/approved/rejected)
- `tasks` - Approved tasks only

### Loop 2 Tables
- `threads` - Aggregated email conversations with waiting-on status
- `follow_up_suggestions` - AI-generated follow-up drafts
- `audit_log` - All actions logged with entity_type, entity_id, action, actor, previous_state, new_state

### Loop 3 Tables
- `daily_briefs` - Morning/evening reports with JSONB content
- `notifications` - All notifications with read/push status
- `push_subscriptions` - Web Push subscriptions for each device

### Key Views
- `waiting_on_threads` - Threads I'm waiting on with days_waiting
- `pending_approvals_count` - Counts for nav badges
- `unread_notification_count` - For notification bell badge
- `recent_notifications` - For notification dropdown

## KEY FILES

### API Routes
- `app/api/cron/process-emails/route.ts` - Fetch Gmail, extract tasks via AI, send notifications
- `app/api/cron/sync-threads/route.ts` - Aggregate emails into threads, detect waiting-on, send notifications
- `app/api/cron/generate-brief/route.ts` - Generate morning/evening briefs with AI
- `app/api/notifications/route.ts` - List notifications, mark all read
- `app/api/notifications/[id]/route.ts` - Mark single notification as read
- `app/api/notifications/subscribe/route.ts` - Register/remove push subscriptions
- `app/api/tasks/[id]/route.ts` - Task status updates
- `app/api/follow-ups/route.ts` - List follow-ups
- `app/api/follow-ups/[id]/route.ts` - Approve/reject follow-ups
- `app/api/follow-ups/[id]/send/route.ts` - Send approved follow-up via Gmail
- `app/api/follow-ups/generate/[threadId]/route.ts` - AI generates follow-up draft

### Pages
- `app/page.tsx` - Home with navigation
- `app/approvals/page.tsx` - Task suggestion approval UI
- `app/tasks/page.tsx` - Task management
- `app/waiting-on/page.tsx` - Stalled threads list
- `app/review/page.tsx` - Unified approval queue
- `app/layout.tsx` - Global layout with PWA meta tags and NotificationBell

### Components
- `components/NotificationBell.tsx` - Notification badge and dropdown
- `hooks/usePushNotifications.ts` - Push subscription management hook

### Libraries
- `lib/supabase/client.ts` - Supabase client
- `lib/supabase/task-queries.ts` - Task/suggestion queries
- `lib/supabase/thread-queries.ts` - Thread/follow-up queries
- `lib/supabase/notification-queries.ts` - Notification/brief/subscription queries
- `lib/supabase/audit-queries.ts` - Audit log queries
- `lib/gmail/client.ts` - Gmail fetch (including fetchMessagesInThreads for sent emails)
- `lib/gmail/send.ts` - Gmail send
- `lib/ai/task-extraction-prompt.ts` - AI prompt for tasks
- `lib/ai/follow-up-prompt.ts` - AI prompt for follow-ups
- `lib/notifications/push.ts` - Web Push notification sender
- `lib/notifications/brief-generator.ts` - AI-powered brief content generation

### PWA Files
- `public/manifest.json` - PWA manifest for installability
- `public/sw.js` - Service worker for push notifications

### Database
- `supabase/migrations/001_ai_task_schema.sql` - Loop 1 schema
- `supabase/migrations/002_threads_followups_audit.sql` - Loop 2 schema
- `supabase/migrations/003_briefs_notifications.sql` - Loop 3 schema

## CONFIGURATION

### Environment Variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://qprhkeaeaaizkagyqrtc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_DB_PASSWORD=...
SUPABASE_ACCESS_TOKEN=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3004/api/auth/google/callback
GOOGLE_REFRESH_TOKEN=...
GMAIL_LABEL_NAME=Work

AI_PROVIDER=openai
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...

CRON_SECRET=...

# VAPID Keys for Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:kincaidgarrett@gmail.com
```

### User Context
- Owner email: kincaidgarrett@gmail.com
- All tasks assigned to this email only
- Waiting-on threshold: 2 days
- Timezone: America/Costa_Rica (UTC-6)
- Morning brief: 7:00 AM (13:00 UTC)
- Evening brief: 8:00 PM (02:00 UTC)

## CURRENT STATUS

**Last Updated**: January 14, 2025

- Loop 1: COMPLETE - Email → Tasks working
- Loop 2: COMPLETE - Waiting-on detection with sent emails working
- Loop 3: COMPLETE - Daily briefs + push notifications
- Migration 003: APPLIED to Supabase
- Deployment: LIVE at https://personal-assistant-ai-lime.vercel.app
- Cron Jobs (cron-job.org):
  - process-emails: every 1 min
  - sync-threads: set up by user
  - generate-brief (morning): 0 13 * * * (7 AM Costa Rica)
  - generate-brief (evening): 0 2 * * * (8 PM Costa Rica)

## CRON JOB SETUP

### cron-job.org URLs
| Job | URL | Schedule (UTC) | Costa Rica Time |
|-----|-----|----------------|-----------------|
| Process Emails | `https://personal-assistant-ai-lime.vercel.app/api/cron/process-emails` | Every 1 min | - |
| Sync Threads | `https://personal-assistant-ai-lime.vercel.app/api/cron/sync-threads` | User configured | - |
| Morning Brief | `https://personal-assistant-ai-lime.vercel.app/api/cron/generate-brief?type=morning` | `0 13 * * *` | 7:00 AM |
| Evening Brief | `https://personal-assistant-ai-lime.vercel.app/api/cron/generate-brief?type=evening` | `0 2 * * *` | 8:00 PM |

All cron jobs require `Authorization: Bearer {CRON_SECRET}` header.

## NEXT STEPS

1. Set up cron jobs for generate-brief on cron-job.org
2. Test PWA installation on phone and desktop
3. Test push notifications work when app is in background
4. Move to Loop 4 (Calendar integration)
