# Galaxy notification badge verification

Per-delivery notifications are enabled in public/sw.js. Room-level tags from the server are intentionally ignored. Every received delivery creates a notification; delivery retries can therefore create duplicates. These are notification counts, not authoritative unread counts. No backend or message records are changed by this experiment.

Priority: Edge, Chrome, then Samsung Internet; test independently on Galaxy phone and tablet.

1. Refresh the published site, sign in, enable notifications in that browser.
2. Use notification count check; require per-message mode confirmation. Clear existing messenger notifications in the OS shade, then confirm zero.
3. Enable numeric app icon badges in Galaxy settings. Add/install the site to the home screen if available. Record whether it is a shortcut or installed web app.
4. Go to the home screen without force-stopping the browser. Wait 30 seconds for active-room suppression to expire.
5. From the other account send three ordinary test messages, several seconds apart.
6. Before reopening the site, record shade notification count (expand groups), messenger icon badge and browser icon badge: number / dot / none.
7. Reopen the site and use notification count check. Reading does not currently clear retained notifications automatically; count is diagnostic only.
8. Dismiss notifications and compare badges again. Repeat after reading on another device to demonstrate unread/notification divergence.

Record device, Android/One UI version, browser version, install type and each result. Do not claim badge success from service-worker unit tests. The private message text is not included in notifications. Existing database unread counts remain unchanged.
