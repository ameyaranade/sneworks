// Firebase Messaging Service Worker
// Must live at the web root so it gets the correct scope.

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDxSyLH6Q8lA8AlOQKf5CCYDEqWQ-RcMj8',
  authDomain: 'sneworks-app.firebaseapp.com',
  projectId: 'sneworks-app',
  storageBucket: 'sneworks-app.firebasestorage.app',
  messagingSenderId: '609886492489',
  appId: '1:609886492489:web:51951d92ca430ec2a42c98',
});

const messaging = firebase.messaging();

// Handle background messages (app not in focus / tab closed)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'SNE Works';
  const body  = payload.notification?.body  ?? '';
  self.registration.showNotification(title, { body, icon: '/icons/icon-192.png' });
});
