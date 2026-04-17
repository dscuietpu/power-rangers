/**
 * Utility to subscribe a user to Web Push notifications.
 * Call this after the volunteer grants notification permission.
 */
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

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

export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
  try {
    if (Capacitor.isNativePlatform()) {
      let permStatus = await LocalNotifications.checkPermissions();
      
      if (permStatus.display === 'prompt') {
        permStatus = await LocalNotifications.requestPermissions();
      }
      
      if (permStatus.display !== 'granted') {
        return { success: false, error: 'User denied native notifications permission.' };
      }
      
      // Android WebViews DO NOT support the Web Push API (PushManager).
      // Since we are running natively, we'll bypass web push and rely on Supabase Realtime 
      // + LocalNotifications in Map.tsx instead.
      return { success: true };
    }

    // 1. Check browser support (for regular Web)
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { success: false, error: 'Push notifications are not supported in this browser.' };
    }

    // fallback/additionally request web permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission denied. Please allow notifications.' };
    }

    // 3. Get the service worker registration
    const registration = await navigator.serviceWorker.ready;

    // 4. Subscribe to push with VAPID public key
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      return { success: false, error: 'VAPID key not configured.' };
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    // 5. Send the subscription to our server
    const res = await fetch('/api/volunteers/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    if (!res.ok) {
      const data = await res.json();
      return { success: false, error: data.error || 'Failed to save subscription on server.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Push subscription error:', err);
    return { success: false, error: err.message || 'Unknown error during push subscription.' };
  }
}
