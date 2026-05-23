import { getMessaging, getToken } from 'firebase/messaging';
import { app } from './config';

const VAPID_KEY = 'BCP-nZw24chjZaiqhXY_JuP2DiPUqyC6mlDLF8dkXNMCjMg4m4ASKfeMAWFwLcD-dxXq-clwKGIfTNS-FHjWj9Q';

// Lazily initialised so the module can be imported without crashing in
// environments that don't support the Notifications API (e.g. SSR, tests).
let _messaging: ReturnType<typeof getMessaging> | null = null;
function getMsg() {
  if (!_messaging) _messaging = getMessaging(app);
  return _messaging;
}

/**
 * Requests browser notification permission, registers the FCM service worker,
 * and returns the FCM registration token (or null if denied / unsupported).
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(getMsg(), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    return token || null;
  } catch (e) {
    console.error('requestNotificationPermission failed:', e);
    return null;
  }
}
