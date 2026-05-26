import { useState, useEffect, useCallback } from 'react';

const SW_URL = '/service-worker.js';

export default function usePushNotifications(token) {
  const [swRegistered, setSwRegistered] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [permissionState, setPermissionState] = useState(Notification.permission);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushSupported(false);
      return;
    }
    navigator.serviceWorker.register(SW_URL).then((reg) => {
      setSwRegistered(true);
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
      });
    }).catch(() => setPushSupported(false));
  }, []);

  const subscribe = useCallback(async () => {
    if (!pushSupported || !swRegistered) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (sub) return;

      const res = await fetch('http://localhost:5000/api/push/vapid-public-key');
      const { publicKey } = await res.json();
      const convertedKey = Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0));

      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      await fetch('http://localhost:5000/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ subscription: sub.toJSON(), userId: token ? 'authenticated' : 'anonymous' })
      });

      setSubscribed(true);
      setPermissionState('granted');
    } catch (e) {
      if (e.name === 'NotAllowedError') setPermissionState('denied');
    }
  }, [pushSupported, swRegistered, token]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      await fetch('http://localhost:5000/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });

      setSubscribed(false);
    } catch (e) { /* ignore */ }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!pushSupported) return;
    const result = await Notification.requestPermission();
    setPermissionState(result);
    if (result === 'granted') await subscribe();
  }, [pushSupported, subscribe]);

  return { pushSupported, permissionState, subscribed, requestPermission, subscribe, unsubscribe };
}
