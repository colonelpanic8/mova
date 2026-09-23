# Mova as an EVA extension

Mova implements EVA's installed-app AIDL protocol v1 (EVA
`docs/extension-protocol.md`) so EVA can read and change todos while the phone
is locked, without opening Mova. This is the locked-state path. `mova://`
links and the content provider ([intents.md](intents.md)) remain for other
callers and for foreground use.

## Why a bound service

A bound service is Android's only locked-state path that also returns a
result:

- Binding cold-starts Mova's process. Mova's `Application` loads the React
  Native libraries but never starts the JS runtime; the service runs natively
  through `MovaClient`.
- No activity is launched, so background-activity-start limits and the
  keyguard never apply.
- The reply is a structured outcome, not a launch acknowledgement. An intent
  handoff can only report that an activity started, never that the server
  applied the change.

## Service

`com.colonelpanic.mova/.eva.EvaExtensionService` declares action
`com.colonelpanic.eva.action.EXTENSION` with metadata
`com.colonelpanic.eva.extension.version = 1`. The AIDL files under
`android/app/src/main/aidl/com/colonelpanic/eva/extension/` are verbatim
copies of EVA's.

Callers are authenticated on every Binder call from `Binder.getCallingUid()`.
Every package sharing the UID must be one of:

- `com.colonelpanic.eva`, signed with EVA's release certificate: SHA-256
  `688df17827dd9a002705baf0400c80f8f4650c6e87c3fc91d41f32be287f8b68`, as
  checked with apksigner on EVA 0.26.0.
- `com.colonelpanic.eva.debug`, accepted only by debug Mova builds and only
  when it is signed with Mova's own certificate.

EVA owns the user's grants. Reads are granted when the user enables the
extension; each write capability needs its own switch, which is off by
default. Grants are keyed on the contract digest and on
`authorizationScopeRevision`. That value is a digest of the server URL and
username, never the password, so signing into another account asks for
approval again.

## Capabilities

The live catalog is [`eva-extension-describe.json`](eva-extension-describe.json).
A unit test keeps it equal to the service's describe reply; regenerate it with
`UPDATE_EVA_FIXTURE=1` after an intentional change.

| Tool                | Effects | Notes                                                                        |
| ------------------- | ------- | ---------------------------------------------------------------------------- |
| `list_templates`    | read    | Keys, prompts, default flag                                                  |
| `find_todos`        | read    | `q`, `limit` 1–50, `total`                                                   |
| `read_todo`         | read    | By org id                                                                    |
| `read_agenda`       | read    | `date`, `span`, overdue/completed flags, habit status                        |
| `invocation_status` | read    | What Mova recorded for an earlier write                                      |
| `create_todo`       | write   | Template capture; `prompts` string map fills custom prompts                  |
| `complete_todo`     | write   | `state` defaults to `DONE`, `date` backdates                                 |
| `update_todo`       | write   | `""` clears scheduled/deadline/priority/body; `tags: []` clears tags         |
| `delete_todo`       | write   | Org id only; the server's `/delete` does not title-check a file and position |

Write refs are either `id` alone or `file` + `pos` + `title`. Writes always
send `strict`, so the server refuses a position whose heading has a different
title instead of falling back to a title search. Title-only lookups are not
offered.

## Outcomes

Every write reply carries `structuredContent.state`, `invocationId` and
`operation`.

| State                 | Status         | Reason                      | Meaning                                                                                                                |
| --------------------- | -------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `completed`           | `completed`    |                             | The server answered 2xx with its own marker (`created`, `completed`, `updated`, `deleted`)                             |
| `uncertain`           | `unknown`      | none or `deadline_exceeded` | The request left the device, but no definitive answer came back: timeout, lost connection, 5xx, 2xx without the marker |
| `failed`              | `failed`       |                             | 2xx with `status: error`                                                                                               |
| `rejected`            | `not_executed` |                             | 4xx such as a strict lookup conflict; nothing changed                                                                  |
| `not_sent`            | `not_executed` | none or `deadline_exceeded` | Offline, DNS or connect failure, or no time left; safe to retry                                                        |
| `invalid_request`     | `not_executed` | `invalid_arguments`         | Bad arguments, unknown template, missing prompt                                                                        |
| `request_id_conflict` | `not_executed` | `invalid_arguments`         | Invocation ID reused with a different payload                                                                          |
| `stale_descriptor`    | `not_executed` | `stale_descriptor`          | Catalog or account changed since EVA approved it                                                                       |
| `busy`                | `not_executed` | `busy`                      | Queue full                                                                                                             |
| `needs_unlock`        | `not_executed` | `not_configured`            | Credential storage not yet available                                                                                   |
| `needs_configuration` | `not_executed` | `not_configured`            | Not signed in, or the server rejected the stored login                                                                 |

Delivery is classified in `MovaClient`:

- A POST uses a fresh connection (`Connection: close`) and a fixed-length
  body.
- A failure before the socket connects is `NOT_SENT`.
- Anything after the connection opens is `UNCERTAIN`, unless the server
  answers definitively.
- Nothing retries a write.

For `create_todo`, a failed template lookup means `/capture` was never sent.

### Idempotency and durable identity

EVA sends a stable invocation ID per journaled call. Mova keeps a journal in
`noBackupFilesDir/eva-invocations.json`, which lives in credential-encrypted
storage and is written atomically. Entries are keyed by caller UID and ID and
kept for 14 days, up to 200 entries.

A write is recorded as started before any network I/O, and its reply is
recorded once known. A repeated ID is never executed again:

- With the same payload, it gets the recorded reply, or `unknown` if it is
  still in flight or the process died mid-write.
- With a different payload, it gets `request_id_conflict`.

`invocation_status` exposes the same record, so EVA can reconcile a call whose
deadline lapsed while Mova was still waiting on the server.

`/capture` does not return the new entry's id, so a completed create points
the caller at `find_todos`.

## Lock and lifecycle states

| Situation                                      | What happens                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locked after the first unlock, app not running | Works. Binding starts the process; credentials are in credential-encrypted storage, which stays available after the first unlock. The Keystore master key does not require an unlocked device.                                                                                                                |
| Before the first unlock after a reboot         | Mova is not direct-boot aware, so its components do not run and EVA cannot bind. Credentials stay in credential-encrypted storage by design and are never copied to device-protected storage. Defensively, the service checks `UserManager.isUserUnlocked()` before touching them and answers `needs_unlock`. |
| Mova force-stopped                             | Android refuses to bind until the user opens Mova once. EVA reports the extension unavailable; nothing was submitted.                                                                                                                                                                                         |
| Process evicted mid-write                      | The journal still holds the started record; a repeat or `invocation_status` reports `interrupted`/`unknown`.                                                                                                                                                                                                  |
| Offline                                        | `not_sent`; no outbox. Retrying is safe.                                                                                                                                                                                                                                                                      |
| Doze or App Standby                            | Network access is suspended for idle apps. A process in use by a foreground activity or foreground service is exempt, so Mova can reach the network while EVA holds it bound from a foreground service or visible UI.                                                                                         |
| Keystore error while the device is locked      | `MovaSharedPrefs` no longer resets the encrypted store while the keyguard is locked; the request answers `needs_configuration` and the stored login survives.                                                                                                                                                 |

Official references:

- [Direct Boot](https://developer.android.com/privacy-and-security/direct-boot)
- [Doze and App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby)
- [Background activity starts](https://developer.android.com/guide/components/activities/background-starts)

## Constraints and follow-ups

- `mova://` write links run in an exported activity with no caller
  authentication, and the filter is `BROWSABLE`. Any app, or a web link a user
  taps, can create, change or delete todos. EVA's bound service does not
  depend on that path; closing it is a separate product decision.
- Mova debug and release builds share the `com.colonelpanic.mova`
  application ID. Installing a debug build replaces the user's app, so
  device testing needs a spare device or an emulator.
- Not yet verified on hardware: cold binding while locked, and network access
  under Doze while EVA holds the binding.
