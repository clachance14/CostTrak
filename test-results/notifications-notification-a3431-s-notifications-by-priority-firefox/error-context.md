# Page snapshot

```yaml
- text: CT
- heading "Welcome to CostTrak" [level=3]
- paragraph: Sign in with your @ics.ac email address
- text: Email Address
- textbox "Email Address": pm@ics.ac
- text: Password
- textbox "Password": testpassword123
- button
- checkbox "Remember me"
- text: Remember me
- link "Forgot your password?":
  - /url: /password-reset
- alert: Invalid email or password
- button "Sign In"
- paragraph: Need help? Contact your system administrator
- paragraph: © 2025 Industrial Construction Services. All rights reserved.
- link "Privacy Policy":
  - /url: /privacy
  - button "Privacy Policy"
- link "Terms of Service":
  - /url: /terms
  - button "Terms of Service"
- link "Security":
  - /url: /security
  - button "Security"
- region "Notifications alt+T"
- button "Open Tanstack query devtools":
  - img
- alert
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- button "Collapse issues badge":
  - img
```