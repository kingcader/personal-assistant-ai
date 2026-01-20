'use client';

import { useState, useEffect } from 'react';
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
  const [diagnostics, setDiagnostics] = useState<{
    isIOS: boolean;
    isStandalone: boolean;
    hasPushManager: boolean;
    hasServiceWorker: boolean;
    hasNotification: boolean;
  } | null>(null);

  // Run diagnostics on mount
  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;
    const hasPushManager = 'PushManager' in window;
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasNotification = 'Notification' in window;

    setDiagnostics({
      isIOS,
      isStandalone,
      hasPushManager,
      hasServiceWorker,
      hasNotification,
    });

    console.log('[Settings] Diagnostics:', {
      isIOS,
      isStandalone,
      hasPushManager,
      hasServiceWorker,
      hasNotification,
      userAgent,
    });
  }, []);

  const handleTestPush = async () => {
    setIsTesting(true);
    setTestStatus(null);

    try {
      // Check if subscribed first
      if (!isSubscribed) {
        setTestStatus('Error: Please enable push notifications first before sending a test.');
        setIsTesting(false);
        return;
      }

      console.log('[Test] Sending test notification...');
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Test] API error:', response.status, errorText);
        setTestStatus(`Error: Server returned ${response.status}. ${errorText}`);
        setIsTesting(false);
        return;
      }

      const result = await response.json();
      console.log('[Test] API response:', result);

      if (result.success) {
        let status = `Sent: ${result.sent}, Failed: ${result.failed}, Total: ${result.total}`;

        // Show detailed errors if any
        if (result.errors && result.errors.length > 0) {
          const errorDetails = result.errors.map((e: any) => {
            let errMsg = e.error || 'Unknown error';
            if (e.statusCode) errMsg += ` (Status: ${e.statusCode})`;
            if (e.responseBody) errMsg += ` - ${e.responseBody}`;
            return errMsg;
          }).join('; ');
          status += ` | Errors: ${errorDetails}`;
        }

        // Show debug info if no subscriptions
        if (result.total === 0) {
          status += ' | No active subscriptions found. Please enable push notifications.';
        }

        // Show VAPID config issues
        if (result.debug && !result.debug.vapid_configured_after_send) {
          status += ` | VAPID keys not configured properly. ${result.debug.vapid_config_error || ''}`;
        }

        setTestStatus(status);
      } else {
        setTestStatus(`Error: ${result.error || 'Unknown error occurred'}`);
      }
    } catch (err) {
      console.error('[Test] Exception:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTestStatus(`Error: ${errorMessage}. Check browser console for details.`);
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
        let status = `VAPID: OK | Subscriptions: ${result.active_subscriptions}`;

        // Show subscription details
        if (result.subscriptions && result.subscriptions.length > 0) {
          const subDetails = result.subscriptions.map((s: any) =>
            `${s.endpoint_preview} (created: ${new Date(s.created_at).toLocaleDateString()})`
          ).join(' | ');
          status += ` | ${subDetails}`;
        }

        setTestStatus(status);
      } else {
        setTestStatus('VAPID keys not configured - push notifications disabled');
      }
    } catch (err) {
      setTestStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearSubscriptions = async () => {
    setIsTesting(true);
    setTestStatus(null);

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setTestStatus(result.message);
        // Also unsubscribe locally
        await unsubscribe();
      } else {
        setTestStatus(`Error: ${result.error}`);
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
                disabled={isTesting}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                title={!isSubscribed ? 'Enable push notifications first' : 'Send a test push notification'}
              >
                {isTesting ? 'Sending...' : 'Send Test Notification'}
              </button>
              <button
                onClick={handleClearSubscriptions}
                disabled={isTesting}
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {isTesting ? 'Clearing...' : 'Clear All & Re-subscribe'}
              </button>
            </div>

            {!isSubscribed && (
              <p className="text-sm text-muted-foreground mb-3">
                Enable push notifications first to send a test.
              </p>
            )}

            {/* Diagnostics */}
            {diagnostics && diagnostics.isIOS && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm">
                <strong className="text-blue-600 dark:text-blue-400">iOS Diagnostics:</strong>
                <ul className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
                  <li className="flex items-center gap-2">
                    <span>{diagnostics.isStandalone ? '✅' : '❌'}</span>
                    <span>Installed to Home Screen: {diagnostics.isStandalone ? 'Yes' : 'No'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>{diagnostics.hasPushManager ? '✅' : '❌'}</span>
                    <span>Push API Available: {diagnostics.hasPushManager ? 'Yes' : 'No'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>{diagnostics.hasServiceWorker ? '✅' : '❌'}</span>
                    <span>Service Worker Support: {diagnostics.hasServiceWorker ? 'Yes' : 'No'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>{diagnostics.hasNotification ? '✅' : '❌'}</span>
                    <span>Notifications API: {diagnostics.hasNotification ? 'Yes' : 'No'}</span>
                  </li>
                </ul>
                {!diagnostics.isStandalone && (
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded">
                    <p className="text-red-600 dark:text-red-400 font-medium">⚠️ App not installed properly!</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      Tap the Share button in Safari and select "Add to Home Screen". Then open the app from the home screen icon.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm text-yellow-600 dark:text-yellow-400">
              <strong>iOS Requirements:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>iOS 16.4 or later required</li>
                <li>Must add to Home Screen (not just browser)</li>
                <li>Open app FROM the home screen icon</li>
                <li>If not working: Clear All & Re-subscribe</li>
              </ul>
            </div>

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

        {/* Agent Configuration */}
        <Link
          href="/settings/agent"
          className="block bg-card border border-border rounded-lg p-6 mb-6 hover:border-gray-400 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Agent Configuration</h2>
              <p className="text-sm text-muted-foreground">
                Configure business rules and SOPs that teach the AI how to work
              </p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

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
