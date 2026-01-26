# Changelog

## [5.10.2]

- fix: force data refresh after switching servers
- fix: remove redundant dimming from state selection modal

## [5.10.1]

- fix: show full git commit hash in server version display

## [5.10.0]

- feat: add client-side completion timestamp option
- fix: habit date picker not working on web platform
- fix: bundle JavaScript in CI before building debug APK

## [5.4.0]

- feat: add inline save button next to title input

## [5.3.0]

- feat: show next required indicator on habit graph cells

## [5.2.0]

- feat: add calendar icon to next required date indicator

## [5.1.0]

- feat: add tags editor to edit todo view

## [5.0.1]

- feat: separate past and future dates in habit graph into rows
- feat: group habits at bottom of agenda list view
- fix: use array instead of Fragment in Dialog.Actions

## [5.0.0]

- feat: add customizable habit graph colors (Settings > Colors)
- feat: make habit graph cells tappable to complete on specific dates
- feat: add automatic retry for API requests on server/network errors
- refactor: replace tap-anywhere navigation with edit button in HabitItem
- refactor: replace API singleton with React Context pattern
- refactor: add theme module and ActionButton component
- style: add purple background to habit graph container
- fix: use outlined mode for CaptureBar input to fix asymmetric rounding
- fix: apply explicit border radius to ActionButton for squircle look
- fix: date picker in habit view not working
- fix: handle missing version info gracefully in settings
- fix: handle T separator in datetime values for date picker

## [4.0.0]

- refactor: improve quick action buttons in date picker
- ci: add E2E testing workflow with Detox

## [3.6.2]

- refactor: remove expo-speech-recognition

## [3.6.1]

- refactor: consolidate duplicate utility functions into shared modules

## [3.6.0]

- refactor: unify timestamp structure with date/time/repeater object

## [3.5.1]

- fix: handle snake_case git_commit in version response

## [3.5.0]

- feat: add voice input to capture screen title field
- feat: add voice input to CaptureBar
- feat: add VoiceMicButton component
- feat: add useVoiceInput hook for speech recognition
- feat: add static app shortcut for capture
- feat: add capture button after template input fields

## [3.4.0]

- feat: add state change at different date and habit quick complete

## [3.3.10]

- feat: add setting to hide habits in agenda view by default

## [3.3.9]

- feat: move CaptureBar to top of screen below header
- feat: consolidate metadata API calls for faster app startup
- feat: save default capture template per server
- feat: add KeyboardAwareContainer for cross-platform keyboard handling
- fix: move ColorPaletteProvider outside PaperProvider for Portal access
- fix: increase splash screen logo size from 200 to 280
- fix: position QuickCapture dialog at top of screen
- fix: regenerate splash screen logo with purple color
- fix: update adaptive icon with properly sized purple logo

## [3.3.4]

- feat: use effectiveCategory for category filtering
- feat: save default capture template per server
- fix: use category field from API for category filter
- fix: improve category filter to match org-mode categories

## [3.3.3]

- feat: center header logo and bump to v3.3.0
- feat: add mova logo to app header
- fix: update colorPrimary to purple
- fix: use colorful icon for Android adaptive icon

## [3.2.1]

- fix: update login logo and fix prettier formatting

## [3.2.0]

- feat: update app icons and colors with new mova logo
- feat: make template name clickable in capture bar
- feat: show notification reason and event time in scheduled view

## [3.1.4]

- fix: remove broken quickcapturewidget_preview.png

## [3.1.3]

- fix: update Android icons and change background to light gray

## [3.1.2]

- fix: resolve prettier formatting issues

## [3.1.1]

- fix: show completed items at their time in schedule view

## [3.1.0]

- feat: make login logo expand to fill available space
- feat: group all completed items at end of schedule view

## [3.0.0]

- feat: update app icon and bump to v3.0.0
- feat: group untimed items by completion status in schedule view
- fix: remove border radius from quick capture text input
- fix: resolve prettier formatting and update tests for API changes
- fix: resolve eslint warnings

## [2.2.0]

- feat: add toggleable day schedule view to agenda
- feat: add reusable StatePill component with consistent todo state colors
- feat: add color utility functions
- fix: make schedule view items more compact with horizontal layout
- fix: improve day schedule view layout and functionality
- fix: rename title to new_title in TodoUpdates
- fix: use consistent priorities between edit and capture screens

## [2.1.11]

- feat: add per-field time toggle and logbook viewer

## [2.1.9]

- fix: clean up API payloads and add stricter tests

## [2.1.8]

- feat: add editable properties drawer to todo edit screen
- fix: correct TypeScript types in ScheduledNotificationsModal

## [2.1.7]

- fix: prevent double keyboard space adjustment on Android

## [2.1.6]

- fix: add olpath to todo operations and debug logging for delete

## [2.1.5]

- feat: allow editing todo titles from the edit screen

## [2.1.3]

- fix: use undefined behavior for KeyboardAvoidingView on Android

## [2.1.2]

- feat: add Habits tab to navigation
- feat: add dedicated Habits screen with stats
- feat: display habit graph in TodoItem for window-habits
- feat: add HabitGraph component for rendering habit consistency graphs
- feat: add habits toggle to filter modal
- feat: add showHabits filter to hide/show habits in agenda
- feat: add HabitConfigContext for habit colors and settings
- feat: add color interpolation utilities for habit graphs
- feat: add getHabitConfig and getHabitStatus API methods
- feat: add habit TypeScript types
- fix: restore ScrollView flex style for form fields visibility
- fix: keep text fields visible when keyboard appears

## [2.0.1]

- docs: add habits frontend integration design

## [2.0.0]

- feat: add todo edit page
- feat: update swipe actions - remove Body/Remind, add Delete
- feat: add repeater support for recurring tasks
- feat: add repeater pickers to capture view
- feat: add quick schedule time toggle and single swipeable constraint
- feat: add Google Assistant App Action for task creation
- refactor: remove unused openBodyEditor and openSwipeable functions
- refactor: extract DateFieldWithQuickActions to shared component
- fix: improve settings screen navigation
- fix: improve time toggle for scheduling across all quick actions
- fix: always show repeater pickers in capture view

## [1.5.0]

- feat: add comprehensive filtering support across all views
- feat: use getMetadata() in TemplatesContext
- feat: add getMetadata() API method
- feat: show Capture tab in bottom navigation
- feat: add FAB to add new servers from Manage Servers screen
- feat: add Manage Servers screen
- feat: add password display and manage servers link to settings
- feat: add saved servers list and password toggle to login screen
- feat: add PasswordInput component with show/hide toggle
- feat: add multi-server methods to AuthContext
- feat: add SavedServer types and storage utilities
- refactor: create TemplatesContext for global template state
- refactor: improve TodoItem layout - move tags to same row as scheduled/deadline
- fix: add fallback to individual endpoints when /metadata unavailable
- fix: template dropdown not loading and clean up verbose logging
- fix: use absolute path for servers navigation
- fix: don't auto-lock server URL on localhost
- fix: fetch priorities from server instead of hardcoding A-C
- fix: show full git commit hash in settings
- fix: resolve prettier formatting issues for CI

## [1.4.2]

- feat: auto-refresh views after mutations
- fix: add MutationContext mock to component tests
- fix: register notifications screen in settings layout
- fix: ensure only one todo shows action buttons at a time
- fix: URL suggestion selection and normalize URLs consistently
- fix: add createTodo API method and fix invalid field name test
- feat: add Today/Tomorrow buttons and time toggle to capture screen
- feat: display org-agenda-files in settings

## [1.4.1]

- fix: another null prompts filter in capture.tsx

## [1.4.0]

- feat: add scheduled notifications management and custom reminders
- fix: lint and prettier fixes
- fix: prevent keyboard from covering quick capture dialog

## [1.3.2]

- feat: display app version on login screen

## [1.3.1]

- fix: handle null prompts array from API to prevent crash
- fix: skip Android widget registration on web platform

## [1.2.0]

- Initial public release with capture templates support

## [0.1.0]

- Initial development release
