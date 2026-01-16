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

// Trim whitespace/newlines from VAPID key (env vars can have trailing newlines)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

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
      console.log('[Push] Starting subscription process...');
      console.log('[Push] VAPID Public Key length:', VAPID_PUBLIC_KEY.length);
      console.log('[Push] VAPID Public Key preview:', VAPID_PUBLIC_KEY.slice(0, 20) + '...' + VAPID_PUBLIC_KEY.slice(-10));

      // Check if service worker is supported
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers not supported');
      }

      // Request permission
      console.log('[Push] Requesting notification permission...');
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      console.log('[Push] Permission result:', result);

      if (result !== 'granted') {
        setError('Notification permission denied');
        setIsLoading(false);
        return;
      }

      // Wait for service worker to be ready (with timeout for iOS)
      console.log('[Push] Waiting for service worker...');
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Service worker timeout')), 10000)
        )
      ]);
      console.log('[Push] Service worker ready:', registration.active?.scriptURL);

      // Check if already subscribed
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        console.log('[Push] Unsubscribing from existing subscription...');
        await existingSub.unsubscribe();
      }

      // Prepare the VAPID public key
      // The key should already be in URL-safe base64 format from the env var
      // Convert it to Uint8Array for the pushManager
      let applicationServerKey: BufferSource;
      try {
        applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        console.log('[Push] Converted key to Uint8Array, length:', (applicationServerKey as Uint8Array).length);
      } catch (keyError) {
        console.error('[Push] Error converting VAPID key:', keyError);
        throw new Error(`Invalid VAPID public key format: ${keyError instanceof Error ? keyError.message : 'Unknown error'}`);
      }

      // Subscribe to push
      console.log('[Push] Creating new push subscription...');
      console.log('[Push] Using applicationServerKey length:', (applicationServerKey as Uint8Array).length);
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });
      console.log('[Push] Subscription created:', subscription.endpoint.slice(0, 60) + '...');

      // Detect device info
      const userAgent = navigator.userAgent;
      const isIOS = /iPhone|iPad|iPod/.test(userAgent);
      const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS/.test(userAgent);
      const deviceName = isIOS ? (isSafari ? 'iPhone Safari' : 'iPhone') : 'Unknown';

      // Send subscription to server
      // Keys must be URL-safe base64 encoded for web-push
      console.log('[Push] Sending subscription to server...');
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToUrlSafeBase64(subscription.getKey('p256dh')!),
            auth: arrayBufferToUrlSafeBase64(subscription.getKey('auth')!),
          },
          device_name: deviceName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result_1 = await response.json();
      console.log('[Push] Subscription saved to server:', result_1.subscription_id);

      setIsSubscribed(true);
      console.log('[Push] ✅ Subscription successful!');
    } catch (err) {
      console.error('[Push] ❌ Subscription error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Subscription failed';
      const errorName = err instanceof Error ? err.name : 'Unknown';

      console.error('[Push] Error details:', {
        name: errorName,
        message: errorMsg,
        error: err,
      });

      // Provide specific error messages for common issues
      if (errorName === 'AbortError' || errorMsg.includes('push service error')) {
        setError('VAPID key error: The public key format may be incorrect. Check that NEXT_PUBLIC_VAPID_PUBLIC_KEY matches the server VAPID_PRIVATE_KEY.');
      } else if (errorMsg.includes('timeout')) {
        setError('Service worker timeout - try refreshing the page');
      } else if (errorMsg.includes('not supported')) {
        setError('Push notifications require iOS 16.4+ and must be added to Home Screen');
      } else if (errorMsg.includes('Invalid VAPID')) {
        setError(errorMsg);
      } else {
        setError(`${errorName}: ${errorMsg}`);
      }
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
