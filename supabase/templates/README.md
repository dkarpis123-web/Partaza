# Partaza e-mail templates

The sign-up, password, e-mail change and sign-in e-mails sent by Supabase Auth, in Partaza's look.
Each e-mail is wholly in one language: Lithuanian, or English when the person chose any other language in
the app (the app saves the choice as `lang` in the user's metadata; people without it get Lithuanian).
They are pasted into Supabase: Authentication → Emails → Templates. `{{ .ConfirmationURL }}` and
`{{ .Data.lang }}` are filled in by Supabase.

| File | Supabase template | Subject (paste as is) | Subject if the templated one shows braces |
|---|---|---|---|
| confirm-signup.html | Confirm signup | `{{ if and .Data.lang (ne (printf "%v" .Data.lang) "lt") }}Confirm your e-mail – Partaza{{ else }}Patvirtinkite el. paštą – Partaza{{ end }}` | Patvirtinkite el. paštą – Partaza |
| reset-password.html | Reset password | `{{ if and .Data.lang (ne (printf "%v" .Data.lang) "lt") }}New password – Partaza{{ else }}Naujas slaptažodis – Partaza{{ end }}` | Naujas slaptažodis – Partaza |
| change-email.html | Change email address | `{{ if and .Data.lang (ne (printf "%v" .Data.lang) "lt") }}Confirm your new e-mail – Partaza{{ else }}Patvirtinkite naują el. paštą – Partaza{{ end }}` | Patvirtinkite naują el. paštą – Partaza |
| magic-link.html | Magic link | `{{ if and .Data.lang (ne (printf "%v" .Data.lang) "lt") }}Sign-in link – Partaza{{ else }}Prisijungimo nuoroda – Partaza{{ end }}` | Prisijungimo nuoroda – Partaza |

The sender name and address (Partaza <noreply@partaza.eu>) come from the custom SMTP settings
(Authentication → Emails → SMTP settings), which need an e-mail sending service such as Brevo with the
partaza.eu domain verified. Without custom SMTP, Supabase's own sender and footer stay.
