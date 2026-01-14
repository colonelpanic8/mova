;; Test configuration for E2E testing
;; Sets up org-agenda-files and capture templates

;; Set org-agenda-files to include test data
(setq org-agenda-files '("/data/org"))

;; Ensure we're using the test org directory
(setq org-directory "/data/org")

;; Custom capture template that auto-inserts the current date
;; Template "t" creates a TODO with scheduled date set to today
;; Template "d" creates a dated TODO with timestamp in the body
(setq org-capture-templates
      '(("t" "Todo" entry (file "/data/org/inbox.org")
         "* TODO %?\n  SCHEDULED: %t\n  :PROPERTIES:\n  :CREATED: %U\n  :END:\n")
        ("d" "Dated Todo" entry (file "/data/org/inbox.org")
         "* TODO %? :dated:\n  SCHEDULED: %(org-insert-time-stamp (current-time))\n  :PROPERTIES:\n  :CREATED: %U\n  :END:\n")))
