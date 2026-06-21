# Goodrest Test Credentials

This file contains credentials for testing the restaurant ordering platform (Owner and Rider sections).

---

## 👑 Owner / Admin Dashboard

- **URL:** `/admin/login`
- **Password:** `goodrest88`
- **Role:** Administrator (full access to orders, menu editor, reports, riders panel, and settlements)

---

## 🚴 Riders Panel

- **URL:** `/rider/login`
- **All Rider Passwords:** `test123`

### Available Test Riders:

| Name | Phone Number | Username | Status | Purpose |
|------|--------------|----------|--------|---------|
| **Ankit** | `1122334455` | `rider22` | Active | Owner's specific test rider |
| **Test Rider** | `9999999999` | `testrider` | Active | Standard local test rider |
| **FCFS Test Rider** | `9999999998` | `9999999998` | Active | First-Come-First-Served dispatch testing |
| **E2E Test Rider** | `1234567890` | `1234567890` | Active | End-to-End automated testing |

---

## 🛒 Customer Section

- **URL:** `/`
- **Authentication:** Passwordless (uses session cookies or phone tracking on checkout)
