# Future integrations — design boundaries

These integrations are not active in V0.1. The app must remain useful without them.

## Ollama (V0.3)

Use an explicitly enabled, local Ollama endpoint (default `http://localhost:11434`). Enumerate available models, let the user select one and test connectivity, and apply a bounded timeout. AI checkpoint requests should contain a compact structured summary of opted-in metadata, not personal file contents. Validate structured JSON (`summary`, `completed`, `unfinished`, `next_action`, `confidence`); preserve deterministic checkpoints on timeout, offline state, malformed output, or model failure. Store provenance and avoid presenting a suggestion as an observed fact. No API keys or cloud fallback should be introduced.

## Browser extension (V0.4)

Initial targets: Brave and Chrome using an explicit extension, never scraped browser profile databases. Proposed pairing:

1. User enables browser metadata for a selected context and chooses allowed/excluded domains.
2. Context OS creates a short-lived pairing request displayed to the user.
3. The extension obtains user approval and an authenticated local transport binding.
4. The app accepts versioned metadata only for the active session and enabled source. Enforce context/session binding, message-size limits, schema validation, loopback-only access, origin validation, and a rotating local credential. Reject requests outside an active session.
5. The extension sends only URL, page title, timestamp, and active duration. Default to excluding incognito windows, browser-internal URLs, credentials in URLs, and sensitive domains. Never send page contents without separate explicit consent.
6. Pause/suspend revokes capture until an explicit continuation. Unpairing deletes the local transport binding. No extension endpoint or listener is exposed in V0.1.

A concrete secure transport and extension implementation must be reviewed/tested before this design becomes a supported protocol.

## Accessibility and terminal directories (V0.4)

Window titles require separate per-context consent plus optional macOS Accessibility access. Explain the permission, allow refusal, and continue core functionality. Do not capture screenshots or keystrokes.

An optional shell hook may report only a working directory and terminal/session identity, never commands by default. Use authenticated local IPC with schema validation, active-session checks, and scoped paths. Installation must be explicit, reversible, and documented. V0.1 installs no shell hooks.

## Applications, Git, and launch rules (V0.2)

Collect application activation metadata only while enabled. Use local `git` with separate arguments and explicit working directories; no GitHub credential or network is needed. Persist launch rules explicitly and cap restore actions. Snapshots contain metadata and checkpoint references, not process memory. Momentum must be an explainable deterministic project-activity score, never a psychological judgment.
