# Personal data retention and deletion (template)

**Review with your committee and a legal adviser, e.g. for India's Digital Personal Data Protection Act 2023.**

| Data | Purpose | Kept for | Then |
|---|---|---|---|
| Membership applications (rejected or cancelled) | Administration, dispute handling | 12 months after decision | Delete |
| Members and active applications | Running the membership | Membership period + 24 months | Delete or anonymise |
| Event registrations | Event safety, results, accounting | 24 months after the event | Anonymise (keep counts) |
| Emergency contacts, medical notes | Participant safety on event day | Until 30 days after the event | Clear the fields |
| Payments, refunds | Accounting / tax | As required by law (typically 8 years) | Delete |
| Consent records | Proof of consent | While messaging + 24 months | Delete |
| Notification deliveries | Troubleshooting | 12 months | Delete |
| Contact messages | Replying | 12 months | Delete |
| Audit logs | Security / accountability | 24 months | Delete |
| Admin sessions, rate-limit buckets | Security | Automatic (expiry / 24h) | Deleted by the worker |

## Data minimisation in the product

- Date of birth and gender are collected only when a setting or event requires them.
- The medical section is a declaration plus optional free text. No medical records are requested.
- Emergency contacts and medical notes are visible only to roles with `registrations.restricted`, and appear in exports only for those roles.
- Optional communications use separate, unticked consent boxes.
- Logs redact secrets and sensitive keys, and no passwords or tokens are logged.

## Handling requests

Access, correction or deletion requests go to the club's contact email. A Super Admin locates the person by email in Applications, Members and Event registrations, then exports or corrects the data. Deletion uses SQL against the tables above, keeping payment records required by law. Every such action is recorded in the committee minutes.
