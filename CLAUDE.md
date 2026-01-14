# Personal Assistant AI - Project Context

## Project Vision (North Star)

A private AI business operator assistant that will eventually:
1. Understand business "source of truth" data (contracts, operating agreements, sales process, templates, pro formas, sales numbers)
2. Ingest daily reality signals (daily reports from 5 team members + me)
3. Continuously ingest work emails and extract tasks, follow-ups, drafts
4. Integrate with Google Calendar (read/propose events, attach agendas)
5. Frontend usable on phone and laptop (Dashboard, Inbox, Approvals, Tasks, Calendar, Ask/Chat, Knowledge base)
6. Execute actions ONLY with explicit approval
7. Be fully auditable (log suggestions, approvals, rejections, actions, always reference data sources)

## Build Strategy - Incremental Loops

### Loop #1 - COMPLETED
Email → Suggestions → Approval → Tasks
- Gmail integration with "Work" label
- AI task extraction (GPT-4o-mini)
- Supabase database (emails, suggestions, tasks, people)
- Approvals page to review/edit/approve/reject suggestions
- Tasks created from approved suggestions

### Loop #2 - COMPLETED
"My Tasks" lifecycle
- View tasks at /tasks
- Mark in-progress / completed (Start, Complete, Reopen buttons)
- Sort by due date, priority, status, created

### Loop #3 - IN PROGRESS
Automatic email processing
- Deploy to Vercel (free tier)
- Use cron-job.org (free) to trigger every 1 minute
- Works even when laptop is off

### Future Loops
- Loop #3: Daily brief (summarize changes, pending approvals, due tasks)
- Loop #4: Calendar (read-only)
- Loop #5: Calendar proposals (approval-gated writes)
- Loop #6: Ask/Chat (retrieval with citations)
- Loop #7+: Docs knowledge base, sales data, execution tools, multi-user

## Technical Details

### Key Files
- `lib/gmail/client.ts` - Gmail API integration
- `lib/supabase/task-queries.ts` - Database queries
- `lib/ai/task-extraction-prompt.ts` - AI prompt for task extraction
- `app/api/cron/process-emails/route.ts` - Email processing endpoint
- `app/approvals/page.tsx` - Suggestion approval UI
- `app/tasks/page.tsx` - Task management UI

### Email Processing Flow
1. Cron triggers `/api/cron/process-emails`
2. Fetch emails with "Work" label from Gmail
3. Check if email already processed (idempotent via gmail_message_id)
4. AI extracts tasks for Kincaid only
5. Insert suggestions with status='pending'
6. User approves/rejects at /approvals
7. Approved suggestions become tasks

### Daily Report Logic
- "Daily Report | Kincaid" → Extract ALL tasks (Kincaid's report)
- "Daily Report | [Other Name]" → Only extract if "Kincaid" mentioned in body

### Environment Variables Needed
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REFRESH_TOKEN
- GMAIL_LABEL_NAME (default: "Work")
- OPENAI_API_KEY
- CRON_SECRET (for securing the cron endpoint)

## Current Status
- Deploying to Vercel for automatic email processing
- Will set up cron-job.org for 1-minute triggers
