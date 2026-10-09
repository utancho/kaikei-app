# keirio app update — 2026-10-08

Implemented and published:

- Electron opens /app, which requires login and then opens the workspace.
  Read-only preload flag selects a dedicated native title bar. No filesystem
  or credential APIs are exposed. Existing application ID/data path is retained.
- A local offline recovery page is packaged in the Windows installer.
- Sharing supports VIEWER and existing MEMBER permissions. Viewers cannot
  mutate business-scoped APIs. Shared users use the owner's active plan.
- Invitations use random 256-bit tokens, SHA-256 hashes, seven-day expiration,
  recipient email checks and single-use acceptance. New registrations do not
  acquire membership by email alone. Existing ACTIVE memberships remain intact.
  Older PENDING invitations need the owner to reissue a link.
- Business/dashboard load failures have visible retry states; downstream
  validation errors retain their correct status instead of becoming 401.
- Workflow illustrations use real Three.js/WebGL, lazy loading, 30fps/DPR limits,
  visibility suspension, disposal and a readable fallback.
- Public pages have initial HTML metadata, canonical links, JSON-LD and readable
  article content. Missing articles return 404. Sitemap follows published rows.
  Login/invitation pages are noindex. Conditional asset ETags do not mask blog edits.
- Initial application entry JavaScript reduced from 273,604 to 232,329 raw bytes
  (about 15%). Marketing/3D code is not loaded on app login/dashboard paths.
  Field Core Web Vitals and search rankings have not been measured.
- Blog total is 10: original 3 plus guides 4–10, added without overwriting edits.

Validation:

- Full client/server build and permission unit tests passed.
- Isolated local D1 integration checks passed: login, recipient checks,
  acceptance/reuse/expiration, read-only denial, editor save, revocation.
- Browser checks passed: app login/dashboard, shared user without an individual
  paid plan, owner-only controls, 320–1440px layout, live WebGL, motion reduction.
- Production verified: /app -> login, 10 articles, 10 article sitemap URLs,
  article content/schema in initial HTML and WebGL rendering.
- Windows archive contains main/preload/icon/offline page. Installer:
  desktop/release-workspace/Kaikei-Setup.exe.

Operational limits:

- Accounting remains cloud-connected; no offline transaction editing is promised.
- Invitation email is not automatically sent; the owner shares the secret link.
- Windows installer is a local deliverable; GitHub release download URLs have
  not been updated. macOS binary was not rebuilt on Windows.
- Do not roll back to a server version that lacks VIEWER enforcement while
  VIEWER memberships are active. Preserve new nullable columns; prefer a forward fix.
- Local QA database is isolated in .qa-app-db and excluded from Git.
  Test fixtures never touched production user/accounting records.
