'use client';

/**
 * Push Notifications Hook
 *
 * Handles push notification subscription and permission management.
 * Part of Loop #3: Daily Brief + Push Notifications
 */

import { useState, useEffect, useCallback } from 'react';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface UsePushNotificationsReturn {
  permission: PermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Convert Uint8Array to URL-safe base64 string
 * Required for web-push subscription keys
 */
function arrayBufferToUrlSafeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Convert to base64 and make it URL-safe
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check initial state
  useEffect(() => {
    async function checkState() {
      // Check if push notifications are supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPermission('unsupported');
        setIsLoading(false);
        return;
      }

      // Check current permission
      const currentPermission = Notification.permission as PermissionState;
      setPermission(currentPermission);

      // Check if already subscribed
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('Error checking push subscription:', err);
      }

      setIsLoading(false);
    }

    checkState();
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope);
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    }
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      setError('VAPID public key not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result !== 'granted') {
        setError('Notification permission denied');
        setIsLoading(false);
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      // Send subscription to server
      // Keys must be URL-safe base64 encoded for web-push
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToUrlSafeBase64(subscription.getKey('p256dh')!),
            auth: arrayBufferToUrlSafeBase64(subscription.getKey('auth')!),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      setIsSubscribed(true);
      console.log('Push subscription successful');
    } catch (err) {
      console.error('Push subscription error:', err);
      setError(err instanceof Error ? err.message : 'Subscription failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe locally
        await subscription.unsubscribe();

        // Remove from server
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setIsSubscribed(false);
      console.log('Push unsubscription successful');
    } catch (err) {
      console.error('Push unsubscription error:', err);
      setError(err instanceof Error ? err.message : 'Unsubscription failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  };
}
