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

Windows taskbar: installed Edge/Chrome web apps synchronize the total from successful get_chat_activity responses, including read events on another device. Zero and logout clear the badge. Updates are serialized and unavailable/denied APIs do not break messaging. Exact counts update while the app runs (background timers may be throttled). With all app windows closed, the worker does not have authoritative unread counts; the exact number is refreshed on reopening. Verify minimize/send/read/logout separately. Version 8 was saved but not deployed; the combined release supersedes it.

## Closed-window badge update

The server now includes an authoritative unread total and database snapshot timestamp in each message push. Migration 0006 exposes own-account snapshots to authenticated clients and cross-account snapshots only to service_role. No user token is stored in the worker. The worker checks account binding, serializes badge operations and persists the newest timestamp in IndexedDB to reject older arrivals across worker restarts. Foreground snapshots use the same ordering path. Stable push-job tags suppress retries while leaving different messages as distinct notifications.

On Windows, refresh the installed Edge/Chrome app once, enable push and pin it to the taskbar. Close all messenger windows without logging out, wait 30 seconds (the presence lease expires in 25 seconds), then send three messages from the other account. Confirm the badge updates without reopening. Browser force-stop, OS shutdown, blocked notifications or offline state may prevent immediate receipt. Reading on another device alone does not send an extra silent badge push; the next message push or local app launch reconciles the count. Android numeric badges remain OS/browser dependent.

Local verification: database authorization/count tests; worker tests with zero window clients, out-of-order snapshots, foreground read races, unsupported APIs, cross-account rejection and duplicate delivery coalescing. Actual Windows taskbar and Galaxy results require device verification.

## Read notification cleanup (same account)

Before each server activity request, the running client captures current notifications. Only captured notifications whose room has zero unread messages in the successful response are closed. Notifications arriving during the request and rooms with unread messages remain. A stored device/account binding must match the signed-in account before capture and cleanup. Realtime chat_reads changes, the existing five-second polling fallback, window focus, visibility, connectivity and initial launch all trigger this synchronization. Suspended background tabs catch up on resume; no silent push is promised. Desktop numeric badges continue to use authoritative snapshots.

Galaxy Chrome has user-confirmed numeric notification badges. Edge Android receives and opens notifications but its shortcut has no badge on the tested device; the site cannot force an unsupported launcher badge. Edge notification cleanup is implemented; use the installed Chrome web app when a home icon count is required. Test same-account A/B: third-party message -> both notified -> read A -> running B clears; close B and repeat -> reopen B clears. Preserve a second unread conversation in both cases.
