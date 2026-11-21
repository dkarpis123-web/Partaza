# Partaza e-mail templates

The sign-up, password, e-mail change and sign-in e-mails sent by Supabase Auth, in Partaza's look,
Lithuanian first and English below. They are pasted into Supabase: Authentication → Emails → Templates.
`{{ .ConfirmationURL }}` is filled in by Supabase.

| File | Subject | Supabase template |
|---|---|---|
| confirm-signup.html | Patvirtinkite el. paštą – Partaza | Confirm signup |
| reset-password.html | Naujas slaptažodis – Partaza | Reset password |
| change-email.html | Patvirtinkite naują el. paštą – Partaza | Change email address |
| magic-link.html | Prisijungimo nuoroda – Partaza | Magic link |

The sender name and address (Partaza <noreply@partaza.eu>) come from the custom SMTP settings
(Authentication → Emails → SMTP settings), which need an e-mail sending service such as Brevo with the
partaza.eu domain verified. Without custom SMTP, Supabase's own sender and footer stay.
