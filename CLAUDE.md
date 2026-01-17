# Personal Assistant AI - Project Context

## NORTH STAR VISION

Build a **private, persistent AI operating system** for business and daily execution that:

1. **Ingests everything** - Gmail emails + threads + attachments, business documents (contracts, SOPs, pro formas), call transcripts, daily reports, notes/decisions
2. **Maintains live state** - Tasks, calendar, waiting-on list, active projects/deals/clients/vendors, key people + roles, and a "Current Truth" page representing what is currently true about the business. Monitors its own effectiveness: approval rates, resolution times, patterns
3. **Is always chat-available** - Answer questions grounded in stored data with source citations ("What did we decide?", "What does the contract say?", "What's blocking this?"). Search is foundational: full-text across emails/tasks/threads, semantic search for natural queries, filtering by person/date/status/priority
4. **Proposes and prepares execution** - Drafts emails/messages, prepares checklists, agendas, follow-ups. NEVER takes irreversible actions without approval
5. **Executes with approval gates** - Log what was suggested, what was approved, and what was done. Full auditability. Mistakes are recoverable: rejected suggestions can be reconsidered, cancelled tasks can be restored, activity log shows all actions with undo capability

## CORE PRINCIPLES (NON-NEGOTIABLES)

- **Persistence**: Memory lives in the database (Supabase), not in chat. Claude is the reasoning layer.
- **Grounding**: Every answer/draft must reference sources (email/thread/document/transcript/date)
- **Approval Gates**: Suggestions and drafts require approval before execution (send email, create event, etc.)
- **Auditability**: Explicit audit_log table tracks all actions with previous/new state
- **Incremental Value**: Each loop delivers real, usable functionality

## OPERATIONAL RESILIENCE

The system must be reliable and self-healing:
- **Graceful Failures**: API failures (Gmail, AI) trigger automatic retry with backoff, not crashes
- **Partial Progress**: If 1 of 50 emails fails, 49 still succeed and are saved
- **Degraded Mode**: If external services are down, queue work for later processing
- **Idempotency**: All operations are safe to retry without side effects
- **Health Monitoring**: Alerts when processing stalls or errors spike

Outcome: the system recovers gracefully from failures without losing data.

## DATA GOVERNANCE

Data has a lifecycle with clear retention policies:
- **Active**: Recent emails (<90 days), open tasks, active threads
- **Archived**: Completed tasks >90 days, resolved threads >90 days (searchable but not in daily views)
- **Purged**: Audit logs >2 years, notifications >1 year (configurable)
- **Growth Monitoring**: Storage monitored with alerts at thresholds

Data is never silently lost:
- **Soft Deletes**: Recovery window before permanent removal
- **Reconsider**: Rejected suggestions can be moved back to pending
- **Restore**: Cancelled tasks can be restored within 30 days

Outcome: sustainable long-term storage with no data loss surprises.

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

### Loop 4 - COMPLETED
**AI-Powered Productivity Calendar**
- Sync Google Calendar (read-only) with calendar_events table
- Generate AI "prep packets" for meetings: related tasks, emails, talking points
- Calendar insights in morning briefs (meeting count, focus time, conflicts)
- AI scheduling suggestions for tasks based on calendar availability
- Unified calendar view (list + week grid) showing tasks, events, and suggestions
- View toggle with localStorage persistence
- Week navigation for grid view

### Loop 5 - PLANNED
**Execution Helpers (Task Workbench)**
- Per-task AI actions: draft reply, create checklist, suggest next actions
- Still approval-gated

### Loop 6 - PLANNED
**Calendar Write (Controlled)**
- Propose calendar events
- Write to dedicated "AI Assistant" calendar after approval

### Loop 7 - PLANNED
**Conversational Interface**
- Natural language queries against the knowledge base
- "Where do things stand with X?" returns grounded, cited answers
- Draft generation through conversation ("write a follow-up to John about Y")
- Context-aware: assistant knows current tasks, meetings, waiting-on items

### Loop 8 - PLANNED
**Knowledge Base + RAG**
- Ingest documents, transcripts, notes
- Chunk + embed for retrieval
- Chat with citations

### Loop 9 - PLANNED
**Current Truth Page**
- Structured source-of-truth: agreements, pricing, policies, templates
- Explicit approval for updates

### Loop 10 - PLANNED
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

### Loop 4 Tables
- `calendar_events` - Synced Google Calendar events (by google_event_id)
- `meeting_prep_packets` - AI-generated meeting prep content (JSONB)
- `scheduling_suggestions` - AI suggestions for task time blocks
- `calendar_sync_state` - Track sync progress and tokens

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
- `app/api/cron/sync-calendar/route.ts` - Sync Google Calendar events to database (Loop 4)
- `app/api/notifications/route.ts` - List notifications, mark all read
- `app/api/notifications/[id]/route.ts` - Mark single notification as read
- `app/api/notifications/subscribe/route.ts` - Register/remove push subscriptions
- `app/api/tasks/[id]/route.ts` - Task status updates
- `app/api/tasks/[id]/schedule/route.ts` - Get/generate scheduling suggestions (Loop 4)
- `app/api/tasks/schedule/[suggestionId]/accept/route.ts` - Accept scheduling suggestion (Loop 4)
- `app/api/tasks/schedule/[suggestionId]/dismiss/route.ts` - Dismiss scheduling suggestion (Loop 4)
- `app/api/follow-ups/route.ts` - List follow-ups
- `app/api/follow-ups/[id]/route.ts` - Approve/reject follow-ups
- `app/api/follow-ups/[id]/send/route.ts` - Send approved follow-up via Gmail
- `app/api/follow-ups/generate/[threadId]/route.ts` - AI generates follow-up draft
- `app/api/calendar/route.ts` - Unified calendar data API (Loop 4)
- `app/api/calendar/[eventId]/prep/route.ts` - Get/generate AI prep packets (Loop 4)

### Pages
- `app/page.tsx` - Home with navigation
- `app/approvals/page.tsx` - Task suggestion approval UI
- `app/tasks/page.tsx` - Task management
- `app/waiting-on/page.tsx` - Stalled threads list
- `app/review/page.tsx` - Unified approval queue
- `app/calendar/page.tsx` - Calendar with list/week views (Loop 4)
- `app/layout.tsx` - Global layout with PWA meta tags and NotificationBell

### Components
- `components/NotificationBell.tsx` - Notification badge and dropdown
- `components/calendar/CalendarItem.tsx` - Unified calendar item (event/task/suggestion) (Loop 4)
- `components/calendar/AgendaList.tsx` - Agenda list view (Loop 4)
- `components/calendar/WeekGrid.tsx` - Week grid view (Loop 4)
- `components/calendar/PrepPacket.tsx` - AI prep packet display (Loop 4)
- `hooks/usePushNotifications.ts` - Push subscription management hook

### Libraries
- `lib/supabase/client.ts` - Supabase client
- `lib/supabase/task-queries.ts` - Task/suggestion queries
- `lib/supabase/thread-queries.ts` - Thread/follow-up queries
- `lib/supabase/notification-queries.ts` - Notification/brief/subscription queries
- `lib/supabase/audit-queries.ts` - Audit log queries
- `lib/supabase/calendar-queries.ts` - Calendar event/prep/scheduling queries (Loop 4)
- `lib/gmail/client.ts` - Gmail fetch (including fetchMessagesInThreads for sent emails)
- `lib/gmail/send.ts` - Gmail send
- `lib/google/auth.ts` - Shared Google OAuth client (Loop 4)
- `lib/google/calendar.ts` - Google Calendar API functions (Loop 4)
- `lib/ai/task-extraction-prompt.ts` - AI prompt for tasks
- `lib/ai/follow-up-prompt.ts` - AI prompt for follow-ups
- `lib/ai/meeting-prep-prompt.ts` - AI prompt for meeting prep packets (Loop 4)
- `lib/ai/scheduling-suggestions.ts` - AI scheduling suggestions logic (Loop 4)
- `lib/notifications/push.ts` - Web Push notification sender
- `lib/notifications/brief-generator.ts` - AI-powered brief content generation (+ calendar insights)

### PWA Files
- `public/manifest.json` - PWA manifest for installability
- `public/sw.js` - Service worker for push notifications

### Database
- `supabase/migrations/001_ai_task_schema.sql` - Loop 1 schema
- `supabase/migrations/002_threads_followups_audit.sql` - Loop 2 schema
- `supabase/migrations/003_briefs_notifications.sql` - Loop 3 schema
- `supabase/migrations/005_calendar_schema.sql` - Loop 4 schema (calendar events, prep packets, scheduling)

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

**Last Updated**: January 16, 2025

- Loop 1: COMPLETE - Email → Tasks working
- Loop 2: COMPLETE - Waiting-on detection with sent emails working
- Loop 3: COMPLETE - Daily briefs + push notifications
- Loop 4: COMPLETE - AI-Powered Productivity Calendar
- Migration 005: NEEDS TO BE APPLIED to Supabase
- Deployment: LIVE at https://personal-assistant-ai-lime.vercel.app
- Cron Jobs (cron-job.org):
  - process-emails: every 1 min
  - sync-threads: set up by user
  - generate-brief (morning): 0 13 * * * (7 AM Costa Rica)
  - generate-brief (evening): 0 2 * * * (8 PM Costa Rica)
  - sync-calendar: every 15 min (NEEDS SETUP)

## CRON JOB SETUP

### cron-job.org URLs
| Job | URL | Schedule (UTC) | Costa Rica Time |
|-----|-----|----------------|-----------------|
| Process Emails | `https://personal-assistant-ai-lime.vercel.app/api/cron/process-emails` | Every 1 min | - |
| Sync Threads | `https://personal-assistant-ai-lime.vercel.app/api/cron/sync-threads` | User configured | - |
| Morning Brief | `https://personal-assistant-ai-lime.vercel.app/api/cron/generate-brief?type=morning` | `0 13 * * *` | 7:00 AM |
| Evening Brief | `https://personal-assistant-ai-lime.vercel.app/api/cron/generate-brief?type=evening` | `0 2 * * *` | 8:00 PM |
| Sync Calendar | `https://personal-assistant-ai-lime.vercel.app/api/cron/sync-calendar` | Every 15 min | - |

All cron jobs require `Authorization: Bearer {CRON_SECRET}` header.

## NEXT STEPS

1. Apply migration 005 to Supabase for calendar tables
2. Re-authorize Google OAuth with calendar.readonly scope (may need new refresh token)
3. Set up sync-calendar cron job on cron-job.org (every 15 min)
4. Test calendar sync and prep packet generation
5. Move to Loop 5 (Execution Helpers / Task Workbench)
