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

;; API capture templates for the /capture endpoint
(setq org-agenda-api-capture-templates
      '(("todo"
         :name "Todo"
         :template ("t" "Todo" entry (file "/data/org/inbox.org")
                    "* TODO %^{Title}\n"
                    :immediate-finish t)
         :prompts (("Title" :type string :required t)))
        ("scheduled-todo"
         :name "Scheduled Todo"
         :template ("s" "Scheduled" entry (file "/data/org/inbox.org")
                    "* TODO %^{Title}\nSCHEDULED: %^{When}t\n"
                    :immediate-finish t)
         :prompts (("Title" :type string :required t)
                   ("When" :type date :required t)))
        ("tagged-todo"
         :name "Tagged Todo"
         :template ("g" "Tagged" entry (file "/data/org/inbox.org")
                    "* TODO %^{Title} %^{Tags}g\n"
                    :immediate-finish t)
         :prompts (("Title" :type string :required t)
                   ("Tags" :type tags :required nil)))
        ("note"
         :name "Note"
         :template ("n" "Note" entry (file "/data/org/inbox.org")
                    "* %^{Title}\n[%U]\n\n%?"
                    :immediate-finish t)
         :prompts (("Title" :type string :required t)))
        ("meeting"
         :name "Meeting"
         :template ("m" "Meeting" entry (file "/data/org/inbox.org")
                    "* TODO %^{Title} :meeting:\nSCHEDULED: %^{Date}t\n:PROPERTIES:\n:ATTENDEES: %^{Attendees}\n:END:\n%^{Notes}\n"
                    :immediate-finish t)
         :prompts (("Title" :type string :required t)
                   ("Date" :type date :required t)
                   ("Attendees" :type tags :required nil)
                   ("Notes" :type string :required nil)))))
