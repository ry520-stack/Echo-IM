# Echo notification and conversation follow-up plan

Updated: 2026-05-24

## Implemented in this round

- Conversation deletion persistence: after `/api/messages/clear`, the backend conversation list no longer returns a cleared peer when there is no newer message after the clear time.
- Notification click routing: socket messages now include sender `digitalId`; frontend notifications use `/chat/:digitalId` when available. Backend user search also supports UUID as a fallback so older notification targets still open.
- Moment image composer: uploaded images in the "post moment" screen now use a 3-column grid, up to 9 images, instead of a horizontal strip.

## Push notifications that still need a real integration

The current app can show in-page notifications while the webpage is open. It cannot reliably show phone notification-bar messages after the browser page is closed or suspended without a push system.

For the web version, implement Web Push after the official HTTPS domain is stable:

1. Add a service worker.
2. Generate VAPID keys.
3. Add a frontend subscription flow using `PushManager.subscribe`.
4. Save `PushSubscription` records on the backend per user.
5. Send Web Push from the backend when the receiver is offline, the page is hidden, or socket delivery is unavailable.

For the HBuilderX 5+ App version, use native push instead of browser `Notification`:

1. Integrate UniPush/Getui or vendor push channels.
2. Store the app `clientId` or device token per user.
3. Reuse one backend push entry point that accepts `userId`, title, content, and route target.
4. Open the target chat route from the native push click payload.

Do not treat browser `Notification` as a stable app background notification system.
