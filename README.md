# dsh-ctrl-enter-send

Change the DSH composer's send key from **Enter** to **Ctrl+Enter**: Enter inserts a newline, Ctrl+Enter (Cmd+Enter on macOS) sends.

This fixes a concrete annoyance: when a Chinese IME is left in English mode, hitting Enter to start a new line sends a half-written prompt to the AI instead.

## Install

This package is a DSH bundle distributed from GitHub. Install it with the DSH CLI (the official git-install path) and pin the release tag:

```sh
dsh plugin --profile <your-profile> add github:Geopanret/dsh-ctrl-enter-send#v0.1.0
```

- The plugin is a bundle: after installation it is appended to the profile's `dsh.profile.bundles` and activates the next time the page loads (a page refresh is enough; no DSH restart needed).
- Pinning the tag (or a commit: `github:Geopanret/dsh-ctrl-enter-send#<sha>`) is recommended, so later pushes cannot silently change what you run. Omit the `#<ref>` to track the default branch.
- No build step and no install-script approval are needed: this package is plain JavaScript and ships its built artifacts directly (`client.js` is the whole browser bundle). pnpm does not need an `allowBuilds` entry.
- Uninstall with `dsh plugin --profile <your-profile> remove dsh-ctrl-enter-send` (or from the Plugins page).

Compatibility: DSH `>=0.2.0 <0.3.0` (declared in `engines.dsh`; tested on 0.2.1-rc.5).

## Behavior

| Action (focus in the main chat composer) | Before | After |
|---|---|---|
| Enter | send (or queue/steer while running) | **newline** (same as Shift+Enter) |
| Shift+Enter | newline | newline (unchanged) |
| Ctrl+Enter / Cmd+Enter | complementary delivery mode | **send**, exactly like the Send button (while running it follows Settings → General → busy-Enter: queue or steer) |
| Empty draft + Ctrl+Enter while running with queued messages | steer all queued messages | unchanged |
| Enter while the `/` or `@` menu is open | select the highlighted item | unchanged |
| Enter while an IME is composing | confirm the composition | unchanged |
| Alt+Enter / Ctrl+Shift+Enter / AltGraph+Enter | ignored by the built-in keymap | unchanged |
| Other inputs (rename, inline message edit, settings, dialogs, question cards) | unchanged | unchanged |

Clicking the Send button is unchanged; it and Ctrl+Enter use the same "plain Enter" gesture.

## How it works

The plugin is browser-only. At page boot it installs one capture-phase `keydown` listener on `window` and rewrites the modifier flags of the event object, so the composer's existing keymap takes its own newline branch (Shift+Enter) or its own send branch (plain Enter):

- plain Enter → `shiftKey = true` (built-in newline);
- Ctrl/Cmd+Enter on a non-empty draft → `ctrlKey/metaKey = false` (built-in send);
- empty draft keeps the built-in Cmd/Ctrl+Enter steer-all gesture;
- menus, IME composition, Alt/AltGraph and every other input are left alone.

DOM contract used (DSH 0.2.1-rc.x): `[data-composer-input]`, `[data-composer-card]`, `[data-trigger-menu]`, `[data-composer-overlay]`, `[data-composer-placeholder]`. If any marker is missing, the plugin falls back to the built-in behavior instead of guessing — the worst case is "no change", never a mis-send.

If overriding the event flags is impossible in some environment, the plugin falls back to stopping the original event and replaying a synthetic Enter with the intended flags.

## Known limitations

- The shortcuts cheat sheet/settings page still shows the built-in fixed rows "Enter = send" and "Cmd/Ctrl+Enter = complementary delivery". Those are read-only fixed entries owned by the built-in package and cannot be rewritten by a third-party plugin; the actual behavior is the one above.
- The old Ctrl+Enter "complementary delivery mode" semantics are replaced by the primary send gesture (that is the point of this plugin). The empty-draft "steer all queued messages" gesture is deliberately preserved.
- DSH upgrades may rename the `data-composer-*` markers; the plugin then silently reverts to the built-in keys. Update the selectors in `client.js` after such an upgrade.

## Development

```sh
dsh plugin --profile <dev-profile> add /path/to/dsh-ctrl-enter-send
```

`client.js` is the whole client bundle (no build step); changes are picked up by DSH's client HMR watcher without restarting DSH. Host-side `index.js` changes need a restart.

## License

MIT. See [LICENSE](./LICENSE).

This is a community plugin, not an official DeepSeek package.
