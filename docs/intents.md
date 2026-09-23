# Mova intents API

Mova exposes its todo operations to other Android apps through `mova://` links
and a read-only content provider. The intents let an assistant or automation
app drive mova without mova knowing anything about the caller; the provider
lets it read the agenda back, since an intent cannot return data.

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
Native app and finish with a toast. Because they are activity launches,
Android's background-activity-start limits and the keyguard apply to the
caller; an assistant acting while the phone is locked should use the
authenticated bound service in [eva-extension.md](eva-extension.md), which
also reports whether the server applied the change. "App" actions open mova
and navigate.

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

Authority: `com.colonelpanic.mova.provider`. Read-only; inserts, updates and
deletes throw.

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
custom permission with `protectionLevel="dangerous"`. A consumer declares it
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
- Category capture, custom views navigation, a per-caller permission for
  headless writes, iOS parity for `update` and `delete`.
