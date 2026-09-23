# Mova intents API

Mova exposes its todo operations to other Android apps through `mova://` links
and a content provider. The intents let an assistant or automation app drive
mova without mova knowing anything about the caller. The provider reads the
agenda back, since an intent cannot return data, and its `call()` methods run
writes synchronously, with a result, for apps the user has granted write
access. `call()` is the path to use when the phone may be locked.

Fire a link with a plain `ACTION_VIEW` intent:

```kotlin
startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("mova://create?title=Buy%20milk&scheduled=2026-09-20")))
```

or, from a shell:

```sh
adb shell am start -a android.intent.action.VIEW -d 'mova://create?title=Buy%20milk&scheduled=2026-09-20'
```

Query values are decoded as standard form data: `%20` or `+` is a space, and
a literal plus sign, as in a repeater like `+1w`, must be sent as `%2B`. Any
URL encoder does this for you.

## Actions

| Host            | What it does                                     | Runs      |
| --------------- | ------------------------------------------------ | --------- |
| `create`        | Create a todo through a capture template         | native    |
| `complete`      | Set a todo's state, `DONE` by default            | native    |
| `update`        | Change title, dates, priority, tags, state, body | native    |
| `reschedule`    | Alias of `update`                                | native    |
| `delete`        | Delete a todo and its sub-headings               | native    |
| `refresh`       | Drop caches, optionally git-pull on the server   | native    |
| `open`          | Open a todo's edit screen                        | app       |
| `search`        | Open the search tab with a query                 | app       |
| `agenda`        | Open the agenda on a date                        | app       |
| `capture`       | Typing dialog, optionally prefilled              | native UI |
| `capture-voice` | Speech recognizer, then capture                  | native UI |

"Native" actions run in a small invisible activity written in Kotlin with the
credentials the app stored for the active server. They never start the React
Native app and finish with a toast. The activity may show over the lock
screen, so a caller that is allowed to start activities can run one while the
phone is locked. Because it is an activity launch, Android's
background-activity-start limits still apply, and the result only arrives
through `startActivityForResult`. Background callers should use the
provider's [`call()` methods](#writing-and-reading-synchronously-call), and EVA
uses the bound service in [eva-extension.md](eva-extension.md). "App" actions
open mova and navigate.

### Autonomous writes

All native actions execute immediately without a confirmation sheet so an
automation or assistant can complete the workflow unattended. The legacy
`confirm` query parameter is accepted but ignored.

### Shared parameters and formats

Parameter names match the server's field names.

| Parameter   | Format                                                                                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | Org `ID` property                                                                                                                                                           |
| `file`      | Absolute path of the org file, as returned by the server                                                                                                                    |
| `pos`       | Integer buffer position, as returned by the server                                                                                                                          |
| `title`     | Heading text                                                                                                                                                                |
| `scheduled` | `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`, optional trailing repeater after a space: `2026-09-20T10:00 +1w`. Repeaters are `+`, `++` or `.+` with a count and `d`, `w`, `m` or `y` |
| `deadline`  | Same as `scheduled`                                                                                                                                                         |
| `priority`  | Single letter, `A`                                                                                                                                                          |
| `tags`      | Comma separated, or the parameter repeated                                                                                                                                  |
| `state`     | A TODO keyword, sent verbatim                                                                                                                                               |
| `strict`    | `true` to forbid the server's fallback lookups (`complete`, `update`)                                                                                                       |

A todo reference is `id`, else `file` and `pos`, with `title` as an optional
disambiguator. `complete` and `update` also accept `title` alone, because the
server can look a todo up by exact title. `delete` and `open` want `id` or
`file` plus `pos`. The content provider's `open_uri` column hands you a
correctly built reference for every row.

### `create`

```
mova://create?title=Buy%20milk&template=default&scheduled=2026-09-20T10:00%20%2B1w&priority=A&tags=home,errands&state=NEXT
```

- `title` is required. Without it the typing dialog opens instead.
- `template` is a key from `GET /capture-templates`; defaults to the active
  server's default capture template, else `default`.
- The title fills the template's first required string prompt (the same rule
  the widget uses). `scheduled`, `deadline`, `priority`, `tags` and `state`
  are sent as the server's universal capture values.
- Any other query parameter whose name matches one of the template's prompts,
  case-insensitively, fills that prompt: `mova://create?template=capture-c&title=Dentist&When=2026-09-21`.
  Date prompts take `YYYY-MM-DD`, tag prompts a comma list. Unmatched
  parameters are ignored.
- `body` is accepted and sent as a value named `body`. The deployed server
  only applies it if the template declares a `body` prompt; it is not a
  universal capture field, so for plain templates the body is dropped. Use
  `update` with `body=` after the fact if you need it.

Success toast: `Created: Buy milk`. Result extras: `status`, `title`,
`template`. The server does not yet return the new entry's `id`, `file` or
`pos` from `/capture`.

### `complete`

```
mova://complete?id=1f2e3d&state=DONE&date=2026-09-13
```

- `state` defaults to `DONE`. `date` (`YYYY-MM-DD`) backdates the completion.
- Completion executes immediately without a confirmation sheet.
- Success toast: `Completed: <title>`. Result extras: `status`, `title`.

### `update` and `reschedule`

```
mova://reschedule?file=%2Fdata%2Forg%2Fgtd.org&pos=1234&scheduled=2026-09-22&deadline=
mova://update?id=1f2e3d&new_title=Call%20the%20bank&priority=B&tags=phone&state=NEXT&body=Ask%20about%20fees
```

- Any of `new_title`, `scheduled`, `deadline`, `priority`, `tags`, `state`,
  `body`. At least one is required.
- An empty value clears the field: `deadline=` removes the deadline,
  `tags=` removes all tags, `priority=` removes the priority.
- `new_title` rather than `title`, so `title` stays a pure identifier.
- Success toast: `Updated: <title>`. Result extras: `status`, `title`, `file`,
  `pos` (the position after the edit).

### `delete`

```
mova://delete?id=1f2e3d
```

Deletes with `include_children=true`. Success toast: `Deleted: <title>`.

### `refresh`

```
mova://refresh
mova://refresh?git=true
```

Tells the running app to drop its query cache and redraws agenda widgets.
`git=true` also asks the server to pull its org repositories first.

### `open`

```
mova://open?id=1f2e3d
mova://open?file=%2Fdata%2Forg%2Fgtd.org&pos=1234&title=Call+the+bank
```

Opens the todo's edit screen in the app. Shows an alert if the todo cannot be
found.

### `search`

```
mova://search?q=bank
```

### `agenda`

```
mova://agenda?date=2026-09-20&span=week
```

`span` is `day` or `week`.

### `capture` and `capture-voice`

```
mova://capture?title=Buy%20milk&template=capture-i
mova://capture-voice?template=capture-i
```

`capture` opens the typing dialog with the field prefilled; `capture-voice`
starts the system speech recognizer and submits the result. Both take
`template`, and keep accepting the widget's `widgetId`. The dialogs use
`singleInstance` so they can appear over the lock screen, which means they do
not deliver a result to `startActivityForResult`.

### Results

The native actions run in a normal activity, so `startActivityForResult`
works. Success sets `RESULT_OK` with the extras listed per action. Failure or
cancellation sets `RESULT_CANCELED` with an `error` string. A launch that
opens the typing dialog instead also returns `RESULT_CANCELED`. Assistants
that treat the launch as a handoff can ignore all of this.

### Failure modes

- Not logged in: toast `Mova: Log in to Mova first`. Native actions use the
  credentials saved for the active server; nothing is queued.
- Network or server error: toast with the server's message. There is no
  offline outbox for intents in 7.0; the app's own capture screen still
  queues.
- Bad parameters: toast naming the parameter, nothing sent.

## Reading todos and templates: the content provider

Authority: `com.colonelpanic.mova.provider`. Queries are read-only; inserts,
updates and deletes throw. Changes go through
[`call()`](#writing-and-reading-synchronously-call).

| URI                                                                                                                     | Backed by                   |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `content://com.colonelpanic.mova.provider/todos?q=bank&limit=20`                                                        | `GET /get-all-todos`        |
| `content://com.colonelpanic.mova.provider/todos/<id>`                                                                   | `GET /get-all-todos`, by id |
| `content://com.colonelpanic.mova.provider/agenda?date=2026-09-20&span=day&include_overdue=true&include_completed=false` | `GET /agenda`               |
| `content://com.colonelpanic.mova.provider/templates`                                                                    | `GET /capture-templates`    |

Columns: `id`, `file`, `pos`, `title`, `state`, `priority`, `scheduled`,
`scheduled_repeater`, `deadline`, `deadline_repeater`, `tags` (comma
separated), `category`, `olpath` (`/` separated), `agenda_line`,
`date_relevance`, `completed_at`, `open_uri`, `is_window_habit`,
`habit_completed_on_query_date`, `habit_completion_needed_today`, and
`habit_summary_json`. Timestamps are `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`;
repeaters are strings like `+1w`. A projection selects and orders columns. The
cursor's extras carry `total`, the match count before `limit`.

Habit booleans are integers (`1` or `0`). `is_window_habit` is always present
and defaults to `0`; the other two boolean columns are null when the backing
endpoint did not supply that status. On `/agenda`,
`habit_completed_on_query_date` refers to the requested `date`, while a
required, outstanding habit has `date_relevance` set to `habit_required`.
`habit_completion_needed_today` retains the server field's current-day
meaning and must not be treated as historical-date status.
`habit_summary_json` is null for non-habits or unavailable summaries; otherwise
it contains the complete `habitSummary` object, including ratios,
`completionNeededToday`, `nextRequiredInterval`, window status, and
`miniGraph`. Consumers should tolerate additional object fields.

Template queries return `key`, `name`, `is_default` (`1` or `0`),
`title_prompt`, `prompts_json`, and `capture_uri`. `prompts_json` is an array
of `{name,type,required}` objects. `capture_uri` opens the interactive capture
dialog with that template selected. For headless filing, pass the returned
`key` to `mova://create?template=<key>&title=...`; query parameters matching
the prompt names fill custom template fields as described under `create`.

`q` is a case-insensitive substring match over title, tags, state and
category, with exact title matches first and title-prefix matches next. When
the server supports `q` and `limit` it does the work; older servers, including
the one deployed today, return everything and the provider filters, ranks and
limits locally with the same rules.

Every query calls the server, so query from a background thread. On failure
the provider returns `null` and logs under the `TodoProvider` tag.

### Permission

The provider requires `com.colonelpanic.mova.permission.READ_TODOS`, a
custom permission with `protectionLevel="dangerous"`. The one exception is the
EVA assistant verified by its signing key, which Mova trusts by default
unless the user turns off "Let EVA use Mova" (see
[eva-extension.md](eva-extension.md#default-access-and-the-opt-out)). The
permissions are enforced by the provider's code rather than its manifest
entry, so an app lacking them gets a `SecurityException` from the query or
call itself. A consumer declares it
and requests it at runtime like any dangerous permission; the user sees a
system dialog naming both apps and can revoke it in Settings. Unlike a
`normal` permission, an app cannot grant itself access just by declaring it;
unlike `signature`, it works across signing keys, including the F-Droid build.

```xml
<uses-permission android:name="com.colonelpanic.mova.permission.READ_TODOS" />
<queries>
  <provider android:authorities="com.colonelpanic.mova.provider" />
</queries>
```

```kotlin
requestPermissions(arrayOf("com.colonelpanic.mova.permission.READ_TODOS"), 1)

contentResolver.query(
  Uri.parse("content://com.colonelpanic.mova.provider/templates"),
  null, null, null, null,
)?.use { cursor ->
  while (cursor.moveToNext()) {
    val key = cursor.getString(cursor.getColumnIndexOrThrow("key"))
    val prompts = cursor.getString(cursor.getColumnIndexOrThrow("prompts_json"))
  }
}
```

The `<queries>` entry keeps the provider visible under Android 11's package
visibility rules.

## Writing and reading synchronously: `call()`

`ContentResolver.call` runs any of the operations the
[EVA extension](eva-extension.md) offers. It uses the same argument rules and
reports the same outcome states. Nothing opens on screen and no activity is
launched. The call binds Mova's process even if the app is not running, and
it works while the phone is locked, as long as the phone has been unlocked
once since it last restarted. It is the path to use from background services,
automation apps and assistants.

| Method              | Needs         | Does                                        |
| ------------------- | ------------- | ------------------------------------------- |
| `describe`          | either        | `catalog_json`: the capability list         |
| `list_templates`    | `READ_TODOS`  | Capture templates                           |
| `find_todos`        | `READ_TODOS`  | `q`, `limit`                                |
| `read_todo`         | `READ_TODOS`  | `id`                                        |
| `read_agenda`       | `READ_TODOS`  | `date`, `span`, flags                       |
| `invocation_status` | `READ_TODOS`  | Outcome of an earlier write by `request_id` |
| `create_todo`       | `WRITE_TODOS` | Capture through a template                  |
| `complete_todo`     | `WRITE_TODOS` | `state` defaults to `DONE`                  |
| `update_todo`       | `WRITE_TODOS` | Change or clear fields                      |
| `delete_todo`       | `WRITE_TODOS` | Delete by org `id`                          |

Arguments go in the extras under the names listed in `describe`'s input
schemas. Strings are converted to the declared types, so `pos=12`,
`include_overdue=true` and `tags=home,errands` work from automation apps that
only send strings. Prompt values for `create_todo` go in a nested `prompts`
Bundle. Alternatively, put the whole argument object in `arguments_json`.

Write refs are an org `id` alone, or `file`, `pos` and the exact current
`title` together. The server refuses a position whose heading changed. The
`title`-only lookup that `mova://` links allow is not offered here.

```kotlin
val result = contentResolver.call(
  Uri.parse("content://com.colonelpanic.mova.provider"),
  "complete_todo",
  null,
  bundleOf("id" to "1f2e3d", "request_id" to "my-app-42"),
)
val status = result?.getString("status")   // completed, not_executed, failed, unknown
val state = result?.getString("state")     // completed, uncertain, not_sent, rejected, ...
```

The result Bundle holds:

- `status`: `completed`, `not_executed`, `failed` or `unknown`.
- `reason_code`, when there is one.
- `message`: human-readable.
- `request_id`.
- `state`, on writes.
- `result_json`: the operation's structured result.

States mean the same as in [eva-extension.md](eva-extension.md#outcomes):

- `completed` requires the server's own confirmation.
- `uncertain` means the request may have been applied, so check before
  repeating it.
- `not_sent` is safe to retry.
- `needs_unlock` and `needs_configuration` mean nothing was sent.

Pass a stable `request_id` (1–256 printable ASCII characters) to make a write
idempotent. Mova records it before sending. Repeating the same id and
arguments returns the recorded result instead of running the write again, and
a different payload under the same id is refused. `invocation_status` looks up
an id whose result you lost. Without a `request_id`, every call runs anew.

A write can block on the network for up to 20 seconds and a read for up to
10, so call from a background thread.

`WRITE_TODOS` is a separate `dangerous` permission, declared and requested
like `READ_TODOS`. The system dialog asks the user to let the app create,
change and delete todos, including while the phone is locked. The user can
revoke it in Settings. Verified EVA is exempt from both permissions unless the user
opts out.

## Platform notes

- Native actions and the provider are Android only. On iOS and web the
  JavaScript deep-link handler still serves `create?title=` and `complete`,
  plus the navigation hosts; `update`, `delete` and `refresh` are Android
  only in 7.0.
- Server compatibility: `strict`, `q`, `limit` and `total` need a server with
  todo search support. An older server ignores `strict` and the provider
  falls back to local search.

## Deferred

- Offline queue for intent writes.
- Results from `capture` and `capture-voice`.
- Relative dates such as `today` or `+3d`.
- `/capture` returning the new entry's reference, and `body` as a universal
  capture value (server changes).
- Category capture, custom views navigation, iOS parity for `update` and
  `delete`.
- Requiring a permission for `mova://` write links. They stay open to any
  caller, including browser links; `call()` is the permissioned path.
