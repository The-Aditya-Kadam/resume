# Resume visit email alerts

Implementation: Google Apps Script MailApp, called by the existing Node API over HTTPS. No Brevo, SMTP, paid email provider, or n8n hosting dependency.

Sender: adityakadam66@gmail.com. Recipient: adityakadamjd@gmail.com.

## Deployment

1. Create an Apps Script project in the sender account. Copy `apps-script/Code.gs` and the explicit-scope `apps-script/appsscript.json` manifest into the project.
2. Generate a strong random secret of at least 32 characters. Store it as `VISIT_ALERT_SECRET` in both Apps Script **Script properties** and the existing **aditya-cv-api** Render service's environment. Never put the secret in source, GTM, frontend code, logs, URL parameters, or chat.
3. Run `authorizeAlerts` and let the account owner approve email sending and account email identity. No inbox-reading permission is needed. Do not bypass Google warnings automatically.
4. With owner approval, deploy a Web app executing as the sender account, accessible to Anyone. The public endpoint accepts signed requests only; it cannot choose a recipient or email body from input. Copy its `/exec` URL into Render's `VISIT_ALERT_SCRIPT_URL` environment variable.
5. Set `VISIT_ALERTS_ENABLED=true` on the API service and deploy the API and resume static site. Preserve unrelated environment variables and the current CV data.
6. Open the homepage and confirm the custom email in the recipient inbox. Verify the From address and IST time. Refresh within 30 minutes: no second alert. Check GA4 still works. A successful send API response proves acceptance, not inbox delivery.
7. Disable with `VISIT_ALERTS_ENABLED=false` followed by an API deployment. Archive the Apps Script deployment to revoke endpoint access.

## Behavior and limits

- Custom subject: Someone visited your résumé, Aditya. Blue/white HTML design with page, IST timestamp, action, and View my résumé button; plain-text fallback included.
- One attempt per browser per fixed 30-minute window in localStorage, shared across tabs. Blocked storage disables alerts for that browser.
- Backend limits: 20 attempts/hour and 90/day, using UTC counters in PostgreSQL. Apps Script independently enforces these limits and checks its remaining MailApp quota. Consumer Google accounts currently allow 100 recipients/day across scripts; the extra margin does not guarantee available quota if other scripts send email.
- Failed sends consume quota and are not automatically retried. Alerts are best effort; free Render cold starts, blocked scripts, network errors, or Google's delivery can delay or prevent them.
- Deduplication and counters survive service restarts. Two new alert-only tables are created lazily after activation; existing CV records/history are untouched. Session IDs are hashed. Alert rows are cleaned after two days on later visits.
- Requests to Google contain only a hashed session event ID and server timestamp, authenticated with HMAC-SHA256. Five-minute freshness validation and replay suppression protect the Google endpoint. No visitor IP, name, email, referrer, query parameters, or user agent is forwarded to Google for the notification.
- Known crawler user agents are filtered. Origin checks prevent ordinary cross-site browser triggers but are not authentication. Forged browser requests can still consume the capped allowance; the email does not claim a verified human visitor.
- A browser page load triggers an alert, not every raw HTTP request or search impression. Resetting storage or changing browser can create additional alerts.
- No paid upgrades are enabled automatically.

References:
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/reference/mail/mail-app
- https://developers.google.com/apps-script/guides/services/quotas
