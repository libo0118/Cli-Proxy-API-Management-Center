# Qoder custom branch

`qoder-custom` adds Qoder Credits to both Quota Management and Auth Files. Teams, dedicated/SOTA and shared pools are displayed separately. Refresh uses the authenticated CPA plugin endpoint; it does not invoke models. Unknown shared capacity has no invented percentage.

This frontend requires the matching Qoder plugin Credits fields: `kind`, `name`, `remain`, `used`, `size`, `size_known`, `available`, and `cycle_end`.

The v1.26.0 merge uses the v8 core Management API while retaining the deployed v0 extension routes for Key policies and Qoder/WorkBuddy Credits. These are explicit custom endpoints, not a legacy login or core API fallback. Custom Qoder, WorkBuddy, and Cursor cards retain their detailed billing fields when the backend also advertises generic quota support.

Codex recovery still refreshes credential status after a confirmed quota recovery. Reset handling accepts the upstream idempotent acknowledgement, validates reset results and connection/cache ownership, and warns after a consumed credit if cooldown clearing or refresh fails.

The new Korean and Vietnamese locales use the existing English wording for private feature additions; the other four translations are preserved.

## Updating

Keep `upstream` pointed at `router-for-me/Cli-Proxy-API-Management-Center` and `origin` at this fork. Keep upstream history on the default branch; deploy builds from `qoder-custom`.

1. Fetch the selected official stable tag: `git fetch upstream --tags`.
2. Switch to this branch: `git switch qoder-custom`.
3. Merge that tag with `git merge <stable-tag>` and resolve conflicts while preserving the Qoder adapter and both page integrations.
4. Run `bun install --frozen-lockfile` and `bun run verify`.
5. Back up the existing management page, then deploy `dist/index.html` as `management.html` and verify both pages in a browser.

For a custom deployment, disable CPA's automatic official panel replacement (`remote-management.disable-auto-update-panel: true`). Re-enable it only when the official panel contains the required functionality. Do not commit server configuration, auth files, management keys or build caches.
