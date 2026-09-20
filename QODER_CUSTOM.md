# Qoder custom branch

`qoder-custom` adds Qoder Credits to both Quota Management and Auth Files. Teams, dedicated/SOTA and shared pools are displayed separately. Refresh uses the authenticated CPA plugin endpoint; it does not invoke models. Unknown shared capacity has no invented percentage.

This frontend requires the matching Qoder plugin Credits fields: `kind`, `name`, `remain`, `used`, `size`, `size_known`, `available`, and `cycle_end`.

## Updating

Keep `upstream` pointed at `router-for-me/Cli-Proxy-API-Management-Center` and `origin` at this fork. Keep upstream history on the default branch; deploy builds from `qoder-custom`.

1. Fetch the selected official stable tag: `git fetch upstream --tags`.
2. Switch to this branch: `git switch qoder-custom`.
3. Merge that tag with `git merge <stable-tag>` and resolve conflicts while preserving the Qoder adapter and both page integrations.
4. Run `bun install --frozen-lockfile` and `bun run verify`.
5. Back up the existing management page, then deploy `dist/index.html` as `management.html` and verify both pages in a browser.

For a custom deployment, disable CPA's automatic official panel replacement (`remote-management.disable-auto-update-panel: true`). Re-enable it only when the official panel contains the required functionality. Do not commit server configuration, auth files, management keys or build caches.
