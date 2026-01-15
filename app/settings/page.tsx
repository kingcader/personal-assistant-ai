'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function SettingsPage() {
  const {
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestPush = async () => {
    setIsTesting(true);
    setTestStatus(null);

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setTestStatus(
          `Test notification sent to ${result.sent} device(s)${result.failed > 0 ? ` (${result.failed} failed)` : ''}`
        );
      } else {
        setTestStatus(`Error: ${result.error}`);
      }
    } catch (err) {
      setTestStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsTesting(true);
    setTestStatus(null);

    try {
      const response = await fetch('/api/notifications/test');
      const result = await response.json();

      if (result.vapid_configured) {
        setTestStatus(
          `VAPID configured. ${result.active_subscriptions} active subscription(s).`
        );
      } else {
        setTestStatus('VAPID keys not configured - push notifications disabled');
      }
    } catch (err) {
      setTestStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        {/* Push Notifications Section */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Push Notifications</h2>

          {/* Status */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-muted-foreground">Status:</span>
              {isLoading ? (
                <span className="text-yellow-500">Loading...</span>
              ) : permission === 'unsupported' ? (
                <span className="text-red-500">Not supported in this browser</span>
              ) : permission === 'denied' ? (
                <span className="text-red-500">Blocked by browser</span>
              ) : isSubscribed ? (
                <span className="text-green-500">Enabled</span>
              ) : (
                <span className="text-yellow-500">Not enabled</span>
              )}
            </div>

            {permission === 'denied' && (
              <p className="text-sm text-muted-foreground">
                Push notifications are blocked. Please enable them in your browser settings.
              </p>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mb-4">
            {!isSubscribed && permission !== 'denied' && permission !== 'unsupported' && (
              <button
                onClick={subscribe}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Enabling...' : 'Enable Push Notifications'}
              </button>
            )}

            {isSubscribed && (
              <button
                onClick={unsubscribe}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Disabling...' : 'Disable Push Notifications'}
              </button>
            )}
          </div>

          {/* Test section */}
          <div className="border-t border-border pt-4 mt-4">
            <h3 className="font-medium mb-3">Test Push Notifications</h3>
            <div className="flex flex-wrap gap-3 mb-3">
              <button
                onClick={handleCheckStatus}
                disabled={isTesting}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {isTesting ? 'Checking...' : 'Check Status'}
              </button>
              <button
                onClick={handleTestPush}
                disabled={isTesting || !isSubscribed}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isTesting ? 'Sending...' : 'Send Test Notification'}
              </button>
            </div>

            {!isSubscribed && (
              <p className="text-sm text-muted-foreground mb-3">
                Enable push notifications first to send a test.
              </p>
            )}

            {testStatus && (
              <div className={`p-3 rounded text-sm ${
                testStatus.startsWith('Error')
                  ? 'bg-red-500/10 border border-red-500/20 text-red-500'
                  : 'bg-green-500/10 border border-green-500/20 text-green-500'
              }`}>
                {testStatus}
              </div>
            )}
          </div>
        </div>

        {/* Notification Frequency Info */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Notification Frequency</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Morning Brief:</strong> Once daily at 7:00 AM (Costa Rica time)
            </li>
            <li>
              <strong className="text-foreground">Evening Brief:</strong> Once daily at 8:00 PM (Costa Rica time)
            </li>
            <li>
              <strong className="text-foreground">Waiting for Reply:</strong> Once every 3 days per thread
            </li>
            <li>
              <strong className="text-foreground">New Task Suggestions:</strong> When new tasks are extracted from emails
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
