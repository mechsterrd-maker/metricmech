#!/usr/bin/env python3
"""Email the founder via Resend after each run.
Usage: python3 content-engine/scripts/notify.py success|failure "subject" "body-text"
Requires RESEND_API_KEY. NOTIFY_TO defaults to rajadurai92r@gmail.com; NOTIFY_FROM must be a
verified Resend sender (defaults to onboarding@resend.dev which works without domain setup)."""
import os, sys, json, urllib.request

def main():
    status, subject, body = sys.argv[1], sys.argv[2], sys.argv[3]
    key = os.environ.get('RESEND_API_KEY')
    if not key:
        print('RESEND_API_KEY not set — skipping email (not an error).'); return
    payload = {
        "from": os.environ.get('NOTIFY_FROM', 'Blog Autopilot <onboarding@resend.dev>'),
        "to": [os.environ.get('NOTIFY_TO', 'rajadurai92r@gmail.com')],
        "subject": ('✅ ' if status == 'success' else '❌ ') + subject,
        "text": body,
    }
    req = urllib.request.Request('https://api.resend.com/emails',
        data=json.dumps(payload).encode(),
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'User-Agent': 'blog-autopilot/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print('notify: sent', r.status)
    except urllib.error.HTTPError as e:
        print('notify failed:', e.code, e.read()[:200])

if __name__ == '__main__': main()
