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

### Loop 4.5 - COMPLETED
**Calendar Enhancements**
- Google Calendar write access (create/update/delete events)
- Task scheduling with drag-drop from sidebar to week grid
- Unscheduled tasks sidebar in week view
- Create Event and Create Task modals
- Reminder system with push notifications (5min, 15min, 30min, 1hr, 1day before)
- Unschedule button to remove task from calendar while keeping the task
- `/api/cron/send-reminders` endpoint (runs every 5 minutes)

### Loop 5 - COMPLETED
**Knowledge Base + RAG System**
- Google Drive integration with folder sync
- Text extraction for Google Docs, PDFs, Sheets, text files
- Semantic chunking with configurable token limits and overlap
- OpenAI embeddings (text-embedding-3-small, 1536 dimensions)
- pgvector for semantic search with HNSW indexing
- Truth priority weighting (standard/high/authoritative)
- `/knowledge-base` page with folder management, document list, semantic search
- Task-document linking with auto-association
- `/api/cron/sync-drive` - Sync files from Drive (every 30 min)
- `/api/cron/process-kb` - Extract, chunk, embed (every 10 min)

### Loop 5.5 - COMPLETED
**RAG System Improvements**
Enhances Knowledge Base with answer generation, summaries, website crawling, and priority controls.

**Phase 1: Answer Generation with Citations**
- AI synthesizes grounded answers from KB chunks with inline citations
- `lib/ai/answer-generation-prompt.ts` - System prompt enforcing citation requirements
- `app/api/kb/answer/route.ts` - POST endpoint for answer generation
- `components/kb/AnswerPanel.tsx` - Displays answers with collapsible citations
- SearchBar mode toggle: "Get Answer" vs "Search Documents"
- Confidence levels (high/medium/low) based on source coverage

**Phase 2: Document Summaries**
- AI generates 2-3 sentence summaries during indexing
- `lib/ai/summary-generation-prompt.ts` - Concise summary generation
- `app/api/cron/process-kb/route.ts` - Now generates summaries after indexing
- Summaries displayed in search results (blue highlight box)
- `scripts/backfill-summaries.ts` - Backfill script for existing documents

**Phase 3: Website Crawler**
- Crawl company websites and add to RAG system
- `lib/kb/crawler.ts` - Crawler with robots.txt support, rate limiting (1 req/sec)
- `lib/kb/extractors/html.ts` - HTML extraction using cheerio
- `app/api/cron/crawl-websites/route.ts` - Cron endpoint (every 6 hours)
- `app/api/kb/websites/route.ts` - CRUD operations for websites
- `app/api/kb/websites/[id]/route.ts` - Individual website management
- `components/kb/WebsiteList.tsx` - Website management UI
- `components/kb/AddWebsiteModal.tsx` - Add website modal
- Websites tab in knowledge-base page

**Phase 4: Document Priority UI**
- Set processing priority from UI (Normal/High/Urgent)
- `app/api/kb/documents/[id]/priority/route.ts` - PATCH endpoint
- Priority dropdown in DocumentList for pending/failed documents
- Visual badges for high-priority documents
- Higher priority = processed first by cron job

**New Dependencies:**
- `cheerio` - HTML parsing for website crawler

### Loop 6 - COMPLETED
**Entity System + Chat Intelligence**
Transform the AI from a "data retriever" into a "business-aware assistant" by tracking entities and their relationships.

**Entity Types**
- `person` - Individuals (name, email, role, aliases)
- `organization` - Companies, teams, clients, vendors
- `project` - Named projects, initiatives, campaigns
- `deal` - Business deals, contracts, agreements

**Relationship Types**
- `works_at` - Person → Organization
- `owns` - Person → Organization
- `client_of` / `vendor_of` - Organization relationships
- `involved_in` - Person → Project/Deal

**Calendar Query Fix**
- Fixed date range query to use overlap logic (events spanning into range)
- Changed default status from 'confirmed' to 'all'

**Database Schema**
- `supabase/migrations/011_entity_system.sql` - Entity tables
- `entities` - Main entity table with aliases, metadata, mention counts
- `entity_relationships` - Relationships between entities with confidence scores
- `entity_mentions` - Links entities to source records (emails, tasks, events, docs)
- `entity_processing_log` - Tracks which records have been processed
- `find_entity_by_name()` - PostgreSQL function for name/alias lookup

**Entity Extractor**
- `lib/entities/extractor.ts` - AI-powered entity extraction
- Prompts for extracting entities from emails, events, tasks
- Pattern-based entity name detection for chat queries

**Entity Queries**
- `lib/entities/queries.ts` - CRUD operations
- `findEntityByName()` / `findEntityByEmail()` - Lookups
- `upsertEntity()` - Create or update entities
- `getEntityRelationships()` - Get all relationships for an entity
- `createEntityMention()` - Link entities to source records
- `getUnprocessedSources()` - Find records needing entity extraction

**Entity-Aware Context**
- `lib/chat/context.ts` - Added entity context fetching
- `fetchEntityContext(name)` - Comprehensive context for an entity
- `formatEntityForPrompt()` - Format entity data for AI
- Entity lookups include relationships, emails, tasks, meetings

**Intelligent Chat**
- `lib/ai/chat-prompts.ts` - Entity query prompts
- `ENTITY_QUERY_PROMPT` - Generates responses about entities
- `INTELLIGENT_ASSISTANT_PROMPT` - Business-aware assistant prompt
- Chat now routes "tell me about X" queries to entity handler
- Info queries enhanced with entity context

**Background Sync**
- `app/api/cron/sync-entities/route.ts` - Process records for entities
- Extracts entities from emails, calendar events, tasks
- Creates relationships and mentions
- Tracks processing status to avoid re-processing

### Loop 7 - COMPLETED
**Conversational Interface**
Chat-first interface for natural language queries, agenda summaries, and draft generation.

**Intent Classification**
- `lib/ai/chat-prompts.ts` - Intent classifier, agenda synthesis, draft generation prompts
- 10 intent types: knowledge_question, agenda_query, draft_generation, info_query, task_creation, event_creation, email_search, summarization, entity_update, general

**Context Fetching**
- `lib/chat/context.ts` - Unified context fetchers for agenda, person, and KB data
- `fetchAgendaContext()` - Today's tasks, events, waiting-on, pending approvals
- `fetchPersonContext(name)` - Person lookup with related emails and meetings
- `fetchKBContext(query)` - Semantic search on knowledge base

**Chat API**
- `app/api/chat/route.ts` - Main chat endpoint with intent routing
- `app/api/chat/approve/route.ts` - Action approval (email send)
- POST /api/chat - Message handling with citations and actions

**Chat UI Components**
- `app/chat/page.tsx` - Full-page chat interface
- `components/chat/ChatPanel.tsx` - Main chat container
- `components/chat/MessageList.tsx` - Conversation history with auto-scroll
- `components/chat/MessageInput.tsx` - Text input with keyboard shortcuts
- `components/chat/ChatMessage.tsx` - Message display with citations and actions
- `components/chat/DraftPreview.tsx` - Email draft with approve/edit/cancel
- `components/chat/AgendaCard.tsx` - Structured agenda display

**Features**
- Knowledge questions with KB search and grounded answers with citations
- Agenda queries with task/calendar/waiting-on synthesis
- Email draft generation with approval workflow
- Specific lookups (meetings, tasks, people)
- Prominent "Chat with Assistant" button on home page

### Loop 7.5 - COMPLETED
**Manual Entity Creation via Chat**
Allows users to teach the system about people/organizations through natural conversation.

**Entity Update Intent**
- New `entity_update` intent type added to intent classifier
- Detects phrases like "X is the Y", "X works at Y", "Remember that X..."
- Routes to dedicated handler for entity creation/update

**Handler Implementation**
- `handleEntityUpdate()` in `app/api/chat/route.ts`
- Uses `ENTITY_EXTRACTION_SYSTEM_PROMPT` to parse user statements
- Extracts entities (person, organization, project, deal) and relationships
- Sets confidence to 1.0 for user-verified information
- Upserts entities and creates relationships
- Returns confirmation with what was saved

**Entity Notes Field**
- `supabase/migrations/012_entity_notes.sql` - Adds notes column to entities
- Stores user-provided context like "representing our project"
- Different from description (AI-generated) - notes are user-provided
- Notes are merged when entities are updated

**Example Usage**
- "Jen Dalton is the real estate agent at Dalton Group" → Creates person + org + relationship
- "Sarah works at Acme Corp as the CFO" → Creates person with role, org, works_at relationship
- "Remember that the Costa Rica deal is handled by Jen" → Creates deal entity, links to Jen
- "Jen's email is jen@daltongroup.com" → Updates existing Jen entity with email

### Loop 8 - PLANNED
**Multi-Source Ingestion**
- Call transcripts, meeting notes, logs
- Automatic categorization and tagging

### Loop 9 - PLANNED
**Business Intelligence (Focus/Priorities)**
- Current focus tracking
- Priority-based workflows
- Weekly/monthly reflection on patterns, delays, risks

### Loop 10 - PLANNED
**Current Truth Page**
- Structured source-of-truth: agreements, pricing, policies, templates
- Explicit approval for updates

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

### Loop 5 Tables (Knowledge Base)
- `kb_folders` - Synced Google Drive folders with truth priority
- `kb_documents` - File metadata with sync status (pending/processing/indexed/failed)
- `kb_chunks` - Text chunks with pgvector embeddings (1536 dimensions)
- `task_documents` - Task-document links with relevance scores
- `kb_search_history` - Search query analytics

### Loop 6 Tables (Entity System)
- `entities` - People, organizations, projects, deals with aliases and metadata
- `entity_relationships` - Relationships between entities (works_at, client_of, involved_in, etc.)
- `entity_mentions` - Links entities to source records (email, task, calendar_event, kb_document)
- `entity_processing_log` - Tracks which records have been processed for entity extraction

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
- `app/api/cron/sync-drive/route.ts` - Sync Google Drive folders (Loop 5)
- `app/api/cron/process-kb/route.ts` - Process pending documents + generate summaries (Loop 5/5.5)
- `app/api/cron/crawl-websites/route.ts` - Crawl websites for KB (Loop 5.5)
- `app/api/kb/search/route.ts` - Semantic search API (Loop 5)
- `app/api/kb/answer/route.ts` - AI answer generation with citations (Loop 5.5)
- `app/api/kb/folders/route.ts` - List/add folders (Loop 5)
- `app/api/kb/folders/[id]/route.ts` - Get/update/delete folder (Loop 5)
- `app/api/kb/websites/route.ts` - Website CRUD (Loop 5.5)
- `app/api/kb/websites/[id]/route.ts` - Website management (Loop 5.5)
- `app/api/kb/documents/[id]/priority/route.ts` - Document priority updates (Loop 5.5)
- `app/api/tasks/[id]/context/route.ts` - Task-document context (Loop 5)
- `app/api/chat/route.ts` - Chat endpoint with intent classification and entity routing (Loop 6/7)
- `app/api/chat/approve/route.ts` - Action approval (email send) (Loop 7)
- `app/api/cron/sync-entities/route.ts` - Extract entities from emails, events, tasks (Loop 6)

### Pages
- `app/page.tsx` - Home with navigation (+ Chat button)
- `app/chat/page.tsx` - Chat interface (Loop 7)
- `app/approvals/page.tsx` - Task suggestion approval UI
- `app/tasks/page.tsx` - Task management
- `app/waiting-on/page.tsx` - Stalled threads list
- `app/review/page.tsx` - Unified approval queue
- `app/calendar/page.tsx` - Calendar with list/week views (Loop 4)
- `app/knowledge-base/page.tsx` - Knowledge Base search and folder management (Loop 5)
- `app/layout.tsx` - Global layout with PWA meta tags and NotificationBell

### Components
- `components/NotificationBell.tsx` - Notification badge and dropdown
- `components/calendar/CalendarItem.tsx` - Unified calendar item (event/task/suggestion) (Loop 4)
- `components/calendar/AgendaList.tsx` - Agenda list view (Loop 4)
- `components/calendar/WeekGrid.tsx` - Week grid view (Loop 4)
- `components/calendar/PrepPacket.tsx` - AI prep packet display (Loop 4)
- `components/kb/FolderList.tsx` - Synced folders list (Loop 5)
- `components/kb/DocumentList.tsx` - Documents in folder with priority controls (Loop 5/5.5)
- `components/kb/SearchBar.tsx` - Search with mode toggle (Get Answer/Search) (Loop 5/5.5)
- `components/kb/SearchResults.tsx` - Search results with summaries (Loop 5/5.5)
- `components/kb/AnswerPanel.tsx` - AI answer display with citations (Loop 5.5)
- `components/kb/AddFolderModal.tsx` - Add Drive folder modal (Loop 5)
- `components/kb/WebsiteList.tsx` - Website management list (Loop 5.5)
- `components/kb/AddWebsiteModal.tsx` - Add website modal (Loop 5.5)
- `components/kb/TaskContextPanel.tsx` - Related documents for tasks (Loop 5)
- `components/chat/ChatPanel.tsx` - Main chat container (Loop 7)
- `components/chat/MessageList.tsx` - Conversation history (Loop 7)
- `components/chat/MessageInput.tsx` - Text input with keyboard shortcuts (Loop 7)
- `components/chat/ChatMessage.tsx` - Message display with citations (Loop 7)
- `components/chat/DraftPreview.tsx` - Email draft approval UI (Loop 7)
- `components/chat/AgendaCard.tsx` - Structured agenda display (Loop 7)
- `hooks/usePushNotifications.ts` - Push subscription management hook

### Libraries
- `lib/supabase/client.ts` - Supabase client
- `lib/supabase/task-queries.ts` - Task/suggestion queries
- `lib/supabase/thread-queries.ts` - Thread/follow-up queries
- `lib/supabase/notification-queries.ts` - Notification/brief/subscription queries
- `lib/supabase/audit-queries.ts` - Audit log queries
- `lib/supabase/calendar-queries.ts` - Calendar event/prep/scheduling queries (Loop 4)
- `lib/supabase/kb-queries.ts` - Knowledge Base folder/document/chunk queries (Loop 5)
- `lib/kb/extractors/index.ts` - Text extraction router (Loop 5)
- `lib/kb/extractors/google-docs.ts` - Google Docs extractor (Loop 5)
- `lib/kb/extractors/pdf.ts` - PDF extractor (Loop 5)
- `lib/kb/extractors/text.ts` - Plain text extractor (Loop 5)
- `lib/kb/extractors/sheets.ts` - Google Sheets extractor (Loop 5)
- `lib/kb/extractors/html.ts` - HTML extractor for websites (Loop 5.5)
- `lib/kb/chunker.ts` - Text chunking logic (Loop 5)
- `lib/kb/embeddings.ts` - OpenAI embedding generation (Loop 5)
- `lib/kb/crawler.ts` - Website crawler with robots.txt support (Loop 5.5)
- `lib/gmail/client.ts` - Gmail fetch (including fetchMessagesInThreads for sent emails)
- `lib/gmail/send.ts` - Gmail send
- `lib/google/auth.ts` - Shared Google OAuth client (Loop 4/5)
- `lib/google/calendar.ts` - Google Calendar API functions (Loop 4)
- `lib/google/drive.ts` - Google Drive API functions (Loop 5)
- `lib/ai/task-extraction-prompt.ts` - AI prompt for tasks
- `lib/ai/follow-up-prompt.ts` - AI prompt for follow-ups
- `lib/ai/meeting-prep-prompt.ts` - AI prompt for meeting prep packets (Loop 4)
- `lib/ai/scheduling-suggestions.ts` - AI scheduling suggestions logic (Loop 4)
- `lib/ai/answer-generation-prompt.ts` - AI prompt for grounded answers (Loop 5.5)
- `lib/ai/summary-generation-prompt.ts` - AI prompt for document summaries (Loop 5.5)
- `lib/ai/chat-prompts.ts` - Chat intent classifier, response prompts, and entity prompts (Loop 6/7)
- `lib/chat/context.ts` - Unified context fetching for chat and entities (Loop 6/7)
- `lib/entities/extractor.ts` - AI-powered entity extraction from text (Loop 6)
- `lib/entities/queries.ts` - Entity CRUD operations and lookups (Loop 6)
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
- `supabase/migrations/007_knowledge_base_schema.sql` - Loop 5 schema (KB folders, documents, chunks with pgvector)
- `supabase/migrations/011_entity_system.sql` - Loop 6 schema (entities, relationships, mentions)

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

**Last Updated**: January 18, 2025

- Loop 1: COMPLETE - Email → Tasks working
- Loop 2: COMPLETE - Waiting-on detection with sent emails working
- Loop 3: COMPLETE - Daily briefs + push notifications
- Loop 4: COMPLETE - AI-Powered Productivity Calendar
- Loop 5: COMPLETE - Knowledge Base + RAG System
- Loop 5.5: COMPLETE - RAG Improvements (Answer Generation, Summaries, Website Crawler, Priority UI)
- Loop 6: COMPLETE - Entity System + Chat Intelligence (People, Orgs, Relationships)
- Loop 7: COMPLETE - Conversational Interface (Chat UI, Intent Classification, Draft Generation)
- Loop 7.5: COMPLETE - Manual Entity Creation via Chat
- Migration 007: NEEDS TO BE APPLIED to Supabase (requires pgvector extension)
- Migration 009: NEEDS TO BE APPLIED for Loop 5.5 features (priority, summaries, websites)
- Migration 011: NEEDS TO BE APPLIED for Loop 6 entity system
- Migration 012: APPLIED for Loop 7.5 entity notes field
- Deployment: LIVE at https://personal-assistant-ai-lime.vercel.app
- Cron Jobs (cron-job.org):
  - process-emails: every 1 min
  - sync-threads: set up by user
  - generate-brief (morning): 0 13 * * * (7 AM Costa Rica)
  - generate-brief (evening): 0 2 * * * (8 PM Costa Rica)
  - sync-calendar: every 15 min
  - sync-drive: every 30 min (NEEDS SETUP)
  - process-kb: every 10 min (NEEDS SETUP)
  - crawl-websites: every 6 hours (NEEDS SETUP)
  - sync-entities: every 30 min (NEEDS SETUP)

## CRON JOB SETUP

### cron-job.org URLs
| Job | URL | Schedule (UTC) | Costa Rica Time |
|-----|-----|----------------|-----------------|
| Process Emails | `https://personal-assistant-ai-lime.vercel.app/api/cron/process-emails` | Every 1 min | - |
| Sync Threads | `https://personal-assistant-ai-lime.vercel.app/api/cron/sync-threads` | User configured | - |
| Morning Brief | `https://personal-assistant-ai-lime.vercel.app/api/cron/generate-brief?type=morning` | `0 13 * * *` | 7:00 AM |
| Evening Brief | `https://personal-assistant-ai-lime.vercel.app/api/cron/generate-brief?type=evening` | `0 2 * * *` | 8:00 PM |
| Sync Calendar | `https://personal-assistant-ai-lime.vercel.app/api/cron/sync-calendar` | Every 15 min | - |
| Sync Drive | `https://personal-assistant-ai-lime.vercel.app/api/cron/sync-drive` | Every 30 min | - |
| Process KB | `https://personal-assistant-ai-lime.vercel.app/api/cron/process-kb` | Every 10 min | - |
| Crawl Websites | `https://personal-assistant-ai-lime.vercel.app/api/cron/crawl-websites` | Every 6 hours | - |
| Sync Entities | `https://personal-assistant-ai-lime.vercel.app/api/cron/sync-entities` | Every 30 min | - |

All cron jobs require `Authorization: Bearer {CRON_SECRET}` header.

## NEXT STEPS

### Loop 6 Deployment (Entity System)
1. Apply migration 011 to Supabase for entity system tables
2. Set up sync-entities cron job on cron-job.org (every 30 min)
3. Deploy to Vercel
4. Test entity queries in chat: "Tell me about Jen", "Who is Sarah?"
5. Entity data will populate as the cron job processes existing records

### Loop 5.5 Deployment (RAG Improvements)
1. Apply migration 009 to Supabase for Loop 5.5 features (priority, summaries, kb_websites table)
2. Set up crawl-websites cron job on cron-job.org (every 6 hours)
3. Run backfill script for existing documents: `npx tsx scripts/backfill-summaries.ts`
4. Test answer generation at /knowledge-base (toggle to "Get Answer" mode)
5. Test website crawling by adding a website via the Websites tab
6. Deploy to Vercel

### If migration 007 not yet applied:
1. Apply migration 007 to Supabase for Knowledge Base tables (requires pgvector extension)
2. Re-authorize Google OAuth with drive.readonly scope (new refresh token needed)
3. Set up sync-drive cron job on cron-job.org (every 30 min)
4. Set up process-kb cron job on cron-job.org (every 10 min)
5. Add first Google Drive folder via /knowledge-base page

### Future
- Move to Loop 6 (Entity System)
