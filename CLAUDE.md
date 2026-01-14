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
- **Deployment**: Vercel (planned)

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

### Loop 3 - IN PROGRESS
**Automatic Processing + Deployment**
- Deploy to Vercel
- Cron jobs for `/api/cron/process-emails` and `/api/cron/sync-threads`
- Works 24/7 even when laptop is off

### Loop 4 - PLANNED
**Daily Brief + Notifications**
- Morning brief: top tasks, meetings, waiting-on, new suggestions
- End-of-day report: what happened, what's blocked, what slipped
- Notification system for pending approvals, follow-ups due

### Loop 5 - PLANNED
**Calendar Read + Meeting Prep**
- Sync Google Calendar (read-only)
- Generate "prep packets" for meetings: related tasks, emails, suggested agenda

### Loop 6 - PLANNED
**Execution Helpers (Task Workbench)**
- Per-task AI actions: draft reply, create checklist, suggest next actions
- Still approval-gated

### Loop 7 - PLANNED
**Calendar Write (Controlled)**
- Propose calendar events
- Write to dedicated "AI Assistant" calendar after approval

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

### Key Views
- `waiting_on_threads` - Threads I'm waiting on with days_waiting
- `pending_approvals_count` - Counts for nav badges

## KEY FILES

### API Routes
- `app/api/cron/process-emails/route.ts` - Fetch Gmail, extract tasks via AI
- `app/api/cron/sync-threads/route.ts` - Aggregate emails into threads, detect waiting-on
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

### Libraries
- `lib/supabase/client.ts` - Supabase client
- `lib/supabase/task-queries.ts` - Task/suggestion queries
- `lib/supabase/thread-queries.ts` - Thread/follow-up queries
- `lib/supabase/audit-queries.ts` - Audit log queries
- `lib/gmail/client.ts` - Gmail fetch
- `lib/gmail/send.ts` - Gmail send
- `lib/ai/task-extraction-prompt.ts` - AI prompt for tasks
- `lib/ai/follow-up-prompt.ts` - AI prompt for follow-ups

### Database
- `supabase/migrations/001_ai_task_schema.sql` - Loop 1 schema
- `supabase/migrations/002_threads_followups_audit.sql` - Loop 2 schema

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
```

### User Context
- Owner email: kincaidgarrett@gmail.com
- All tasks assigned to this email only
- Waiting-on threshold: 2 days

## CURRENT STATUS

**Last Updated**: January 14, 2025

- Loop 1: COMPLETE - Email → Tasks working
- Loop 2: CODE COMPLETE - But needs sent email fetching to work properly
- Migration 002: APPLIED to Supabase
- Supabase CLI: LINKED (project qprhkeaeaaizkagyqrtc)
- Deployment: LIVE at https://personal-assistant-ai-lime.vercel.app
- Cron Jobs: User has process-emails running every 1 min from Loop 1

## CRITICAL ISSUE TO FIX

**Loop 2 waiting-on detection doesn't work yet because:**
- System only fetches emails with "Work" label
- User's SENT emails are not being fetched
- Without sent emails, system can't know "I sent last, waiting for reply"

**Solution needed:**
- Modify Gmail client to ALSO fetch sent emails that are replies to Work-labeled threads
- This way system sees full conversation and can detect waiting-on status
- User wants: only fetch sent emails pertaining to work (not all sent emails)

## WHAT'S BEEN BUILT IN LOOP 2

### Database (Migration 002 - APPLIED)
- `threads` table - aggregates emails into conversations
- `follow_up_suggestions` table - AI-generated follow-up drafts
- `audit_log` table - tracks all actions
- `waiting_on_threads` view - shows stalled threads
- `pending_approvals_count` view - for nav badges

### API Endpoints (ALL WORKING)
- `POST /api/cron/sync-threads` - groups emails into threads, detects waiting-on
- `POST /api/follow-ups/generate/:threadId` - AI generates follow-up draft
- `PATCH /api/follow-ups/:id` - approve/reject follow-up
- `POST /api/follow-ups/:id/send` - send approved follow-up via Gmail
- `GET /api/threads?waiting=true` - list waiting-on threads

### UI Pages (ALL WORKING)
- `/waiting-on` - shows stalled threads (currently empty - needs sent emails)
- `/review` - unified approval queue for tasks + follow-ups

### Gmail Send Capability
- `lib/gmail/send.ts` - can send emails via Gmail API (approval-gated)

## NEXT STEPS

1. **IMMEDIATE**: Modify `lib/gmail/client.ts` to also fetch sent emails for Work threads
   - Option: Fetch sent emails that are in threads where we have a Work-labeled email
   - This gives full conversation context without fetching ALL sent emails

2. Add sync-threads cron job to cron-job.org (same pattern as process-emails)

3. Test waiting-on detection with real data

4. Move to Loop 3 (Daily Brief) or Loop 4 (Calendar)
