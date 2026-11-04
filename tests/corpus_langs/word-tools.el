;;; word-tools.el --- Small helpers for counting and tidying words  -*- lexical-binding: t; -*-

;;; Commentary:
;; Commands for writers: count words in a region, find repeated words,
;; and keep a daily word target.

;;; Code:

(require 'cl-lib)

(defgroup word-tools nil
  "Helpers for counting and tidying words."
  :group 'text)

(defcustom word-tools-daily-target 500
  "How many words to aim for each day."
  :type 'integer
  :group 'word-tools)

(defvar word-tools--written-today 0
  "Words added since Emacs started.")

(defun word-tools-count (start end)
  "Count the words between START and END and show the result."
  (interactive "r")
  (let ((words (count-words start end)))
    (message "%d words (%d to go today)"
             words (max 0 (- word-tools-daily-target word-tools--written-today)))
    words))

(defun word-tools-repeated ()
  "Highlight words that appear twice in a row, like \"the the\"."
  (interactive)
  (save-excursion
    (goto-char (point-min))
    (let ((found 0))
      (while (re-search-forward "\\b\\(\\w+\\)\\s-+\\1\\b" nil t)
        (setq found (1+ found))
        (add-text-properties (match-beginning 0) (match-end 0) '(face highlight)))
      (message "%d repeated words" found))))

(defun word-tools--track (beg end _len)
  "Add the words typed between BEG and END to today's count."
  (when (> end beg)
    (cl-incf word-tools--written-today (count-words beg end))))

(define-minor-mode word-tools-mode
  "Keep a running count of the words written today."
  :lighter " Words"
  (if word-tools-mode
      (add-hook 'after-change-functions #'word-tools--track nil t)
    (remove-hook 'after-change-functions #'word-tools--track t)))

(provide 'word-tools)
;;; word-tools.el ends here
