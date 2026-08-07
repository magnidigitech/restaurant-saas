1. Platform Super Admin (Superuser)
Email: admin@platform.com
Password: superadmin123
Access URL: http://admin.localhost:3000/platform-admin/login
Privileges: Onboard restaurants, toggle modules, adjust limits, and view system audit logs.
2. Restaurant Administrator (Tenant Owner)
Since this is a multi-tenant platform, restaurant administrators are onboarded dynamically by the Super Admin:

Log in to the Super Admin portal at http://admin.localhost:3000/platform-admin/login.
Go to the Onboard Tenant tab.
Enter the restaurant name, subdomain (e.g., coyote), select a subscription plan, and enter the primary admin's details (e.g., owner@coyotegrill.com).
Click Onboard Restaurant. The portal will display a dynamic activation link, for example: http://coyote.localhost:3000/activate?token=your-unique-token-here
Open this link in your browser to complete registration (set your name and password, e.g. password123).
Once activated, you can log in at the restaurant login page:
Subdomain URL: http://coyote.localhost:3000/login
Email: owner@coyotegrill.com
Password: password123 (the password configured in step 5)
(Note: Most modern browsers automatically resolve wildcard localhost subdomains like admin.localhost or coyote.localhost to 127.0.0.1 locally without requiring modifications to your /etc/hosts file).

14:32
