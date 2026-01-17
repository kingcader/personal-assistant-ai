-- ============================================
-- FIX: Add RLS policies for notifications tables
-- Without these policies, server-side queries return empty results
-- ============================================

-- ============================================
-- PUSH SUBSCRIPTIONS - Allow all access (single-user app)
-- ============================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to push_subscriptions"
ON push_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- NOTIFICATIONS - Allow all access (single-user app)
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to notifications"
ON notifications
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- DAILY BRIEFS - Allow all access (single-user app)
-- ============================================

ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to daily_briefs"
ON daily_briefs
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- DONE
-- ============================================
