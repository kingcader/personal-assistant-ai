-- ============================================
-- TEST DATA - Sample Email & Suggestions
-- Run this in Supabase SQL Editor to test the approvals page
-- ============================================

-- Insert a test person (you)
INSERT INTO people (email, name)
VALUES ('your.email@example.com', 'Your Name')
ON CONFLICT (email) DO NOTHING;

-- Insert a test sender
INSERT INTO people (email, name)
VALUES ('john.doe@company.com', 'John Doe')
ON CONFLICT (email) DO NOTHING;

-- Insert a test email from John
INSERT INTO emails (
  gmail_message_id,
  thread_id,
  sender_id,
  subject,
  body,
  received_at,
  to_emails,
  has_attachments
)
VALUES (
  'test_msg_12345',
  'test_thread_67890',
  (SELECT id FROM people WHERE email = 'john.doe@company.com'),
  'Q4 Budget Review Needed',
  'Hi team,

Please review the attached Q4 budget by Friday, January 17th. We need to finalize the marketing expenses before the board meeting.

Sarah, can you focus on the marketing section?
Mike, please handle operations.

Thanks!
John',
  NOW() - INTERVAL '2 hours',
  ARRAY['your.email@example.com', 'sarah@company.com', 'mike@company.com'],
  true
);

-- Insert AI-generated suggestions for this email
INSERT INTO suggestions (
  email_id,
  title,
  why,
  suggested_due_date,
  suggested_owner_email,
  priority,
  status,
  ai_model_used
)
VALUES
(
  (SELECT id FROM emails WHERE gmail_message_id = 'test_msg_12345'),
  'Review Q4 budget - Marketing section',
  'Email requests review of marketing expenses by Friday before board meeting',
  '2026-01-17',
  'sarah@company.com',
  'high',
  'pending',
  'gpt-4-turbo-preview'
),
(
  (SELECT id FROM emails WHERE gmail_message_id = 'test_msg_12345'),
  'Review Q4 budget - Operations section',
  'Email requests operations budget review by Friday',
  '2026-01-17',
  'mike@company.com',
  'high',
  'pending',
  'gpt-4-turbo-preview'
),
(
  (SELECT id FROM emails WHERE gmail_message_id = 'test_msg_12345'),
  'Finalize Q4 budget for board meeting',
  'Email mentions need to finalize budget before board meeting',
  '2026-01-17',
  'your.email@example.com',
  'high',
  'pending',
  'gpt-4-turbo-preview'
);

-- Verify data was inserted
SELECT
  s.title,
  s.priority,
  s.status,
  s.suggested_owner_email,
  e.subject,
  e.received_at
FROM suggestions s
JOIN emails e ON s.email_id = e.id
WHERE s.status = 'pending'
ORDER BY s.created_at DESC;
