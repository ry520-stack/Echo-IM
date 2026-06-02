# Domain And VoIP Readiness

This project is prepared to run one WebRTC voice-call path for both web and 5+ App.

## Before The Domain Is Ready

- Keep testing with the Cloudflare temporary HTTPS URL.
- Camera, video capture, and voice messages can be tested in 5+ App through `plus.camera` and `plus.audio`.
- Web voice calls can be tested only on HTTPS or localhost.

## When The Domain Is Ready

1. Point the domain DNS record to the ECS public IP.
2. Configure Nginx HTTPS for the frontend.
3. Proxy these paths to the backend:
   - `/api/`
   - `/socket.io/`
   - `/uploads/`
4. Set the frontend API base to the HTTPS origin:
   - `VITE_API_BASE=https://your-domain.example`
5. Run Socket.IO over WSS by using the HTTPS base URL.
6. Deploy a TURN server before treating calls as stable.

## TURN Settings

The frontend now reads WebRTC ICE settings from environment variables:

```env
VITE_RTC_STUN_URLS=stun:stun.l.google.com:19302
VITE_RTC_TURN_URLS=turn:your-domain.example:3478?transport=udp,turn:your-domain.example:3478?transport=tcp
VITE_RTC_TURN_USERNAME=echo
VITE_RTC_TURN_CREDENTIAL=change-this-strong-password
VITE_RTC_ICE_TRANSPORT_POLICY=all
```

For a quick TURN-only test, temporarily set:

```env
VITE_RTC_ICE_TRANSPORT_POLICY=relay
```

Set it back to `all` for production.

## Runtime Overrides

For temporary testing without rebuilding the frontend, these localStorage keys override the env values:

```js
localStorage.setItem('echo-rtc-turn-urls', 'turn:your-domain.example:3478?transport=udp,turn:your-domain.example:3478?transport=tcp');
localStorage.setItem('echo-rtc-turn-username', 'echo');
localStorage.setItem('echo-rtc-turn-credential', 'change-this-strong-password');
localStorage.setItem('echo-rtc-ice-policy', 'relay');
```

Remove them after testing:

```js
localStorage.removeItem('echo-rtc-turn-urls');
localStorage.removeItem('echo-rtc-turn-username');
localStorage.removeItem('echo-rtc-turn-credential');
localStorage.removeItem('echo-rtc-ice-policy');
```

## 5+ App Notes

- The App can use the same WebRTC call path as the web version.
- HBuilderX manifest still needs microphone, camera, storage/gallery, and network permissions.
- Voice calls should be tested on two real phones across Wi-Fi and 4G/5G.
- Background/lock-screen calling is a later native-level feature, not part of the first stable call pass.
