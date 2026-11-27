# RepairProof progressive web app

## Install and update behavior

The web client serves a root-scoped manifest and PNG icons at 180, 192 and 512 pixels. The service worker is generated from the production build so its precache list contains that build's actual hashed assets. The first install activates immediately; later versions wait for the user to choose **Update now**, then reload under the new worker.

Production installation requires HTTPS (localhost is treated as secure by browsers). The deployment must serve `/sw.js` from the site root with JavaScript MIME type and must allow service workers. The app has no external runtime fonts or image dependencies required to render the core shell.

## Caching and offline behavior

The worker precaches the static app shell, build assets, manifest, icons, and offline fallback. Navigation is network-first and falls back to the cached app shell, then a small offline page if the shell is unavailable. Hashed build assets are cache-only after precaching. The worker never intercepts or caches `/api`, signed evidence URLs, customer authorization responses, private documents, or mutations. A browser `online` event only indicates that the browser sees a network interface; it does not prove the API is reachable.

RepairProof does not use Background Sync for business mutations. Diagnostics, quotation submission, customer approval, repair transitions/completion, and evidence uploads require an active server request. A UI may say a decision or record succeeded only after its API request resolves. The server remains authoritative for all workflow states.

## Local drafts and uploads

Technician diagnostic and quotation drafts are stored in IndexedDB, namespaced by signed-in profile and case, and expire after 14 days. The interface requires an explicit restore or discard action when a previous draft is found. After restoration, edits autosave locally. Draft notices state that the content is only in this browser and has not been submitted or synchronized. A successful server submission deletes the corresponding local draft. Storage errors are surfaced instead of claiming a save succeeded.

Customer names, phone numbers, customer signatures, customer approval decisions, and evidence file bytes are not put in the draft store. A selected evidence file remains in memory while its page stays open; if an upload fails, the technician can retry it while online, which requests a fresh signed upload intent. Closing or reloading that page loses the selected file; it is never sent by a background retry.

Browser storage is scoped to the origin and local browser profile, not encrypted by this application, and may be cleared by the user, browser policy, storage pressure, or device loss. Do not use local drafts on a shared or untrusted device. The server record and server confirmation remain the durable source of truth.

## Operational checks

- Deploy over HTTPS and verify `/manifest.webmanifest`, all three PNG icons, `/sw.js`, and `/offline.html` return successfully.
- Check that the production host preserves the `/api` proxy and that its responses have `Cache-Control: no-store` where required; the service worker does not cache them regardless.
- In browser developer tools, confirm the first visit installs the worker, static assets are precached, and API requests remain network requests.
- Test offline navigation, the offline banner, draft restore/discard, failed upload retry after reconnection, and the explicit service worker update prompt.
- Verify a customer authorization and technician state transition cannot show success while the network is unavailable or before a successful server response.
