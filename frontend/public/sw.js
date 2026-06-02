self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Echo';
  const options = {
    body: data.body || '新消息',
    icon: './favicon.svg',
    badge: './favicon.svg',
    tag: data.tag || 'echo',
    data: {
      url: data.url || (data.chatId ? `#/chat/${data.chatId}` : '/'),
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          client.focus();
          return;
        }
      }
      if (clients.openWindow) {
        clients.openWindow(targetUrl);
      }
    })
  );
});
