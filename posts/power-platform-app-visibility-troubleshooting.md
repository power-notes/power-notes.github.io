# "The Records Are Fine, But I Can't See Any Apps": A Power Platform Access Troubleshooting Story

## The Symptom

A user reports they can't see any apps in Power Platform. Not "an error when opening an app" — no apps show up at all. But they *can* access records directly (via a shared link, Advanced Find, or the Web API). Confusing, right?

The instinct is to go straight to security roles. So that's where we started.

## The Trap: Security Roles Aren't the Whole Story

Security roles control **entity-level and record-level privileges** — what a user can read, write, or delete. They do **not**, by themselves, control whether an app shows up in the app picker. App visibility is governed by a separate, parallel set of conditions:

- Is the app **shared** with the user (directly, or via a team)?
- Does the app have **"Enable security roles"** turned on, and if so, is the user's role in that allow-list?
- Does the user's role have **Read privilege on the App (appmodule) entity** itself — a privilege that's easy to lose in custom or copied roles?
- Does the user have a **license** that covers that app?
- Is there a **Business Unit** mismatch — same role *name*, but a different underlying role record?
- Is the user actually a member of the **team** the app is shared through (not just holding the right role)?

We checked the role assigned to the app and the role assigned to the user. Everything matched. No obvious gap.

## Ruling Things Out, One at a Time

Once "the role looks right" turned out not to be the answer, the investigation became a process of elimination:

1. **Is the user hiding the app themselves?** Model-driven apps can be individually hidden per-user from the app picker. → Not the case here.
2. **Do other users with the identical role see the app?** Yes — which immediately shifted this from a role/app configuration problem to a **user-specific** problem.
3. **Duplicate system user record?** Sometimes a UPN change or re-invite leaves two `systemuser` records, and roles/teams get applied to the wrong one. → No duplicate found.
4. **Team membership** — same teams as the working peers? → Confirmed identical.
5. **Cache/browser state** — cleared cache, tried again. → No change.
6. **Environment-level security group restriction?** → None configured on the environment.

At this point, every visible, comparable configuration matched a peer who *could* see the app. That's the frustrating middle stage of this kind of issue — everything you can compare by eye lines up, and the cause is still invisible.

## The Tool That Actually Solved It: App Access Checker

Here's the permission gap that made this case hard. Viewing and accessing model-driven apps in Dataverse comes down to one of two privilege patterns: **write and create** privilege on the Model-driven App (`appmodule`) table, which makes a user a "maker" persona with visibility into every app in the environment, or **read** privilege on that table combined with the specific security role the app is shared against. Neither pattern says anything about whether the tenant has actually licensed that user for the app — licensing lives in a completely different admin surface (Microsoft 365 / Entra) that a Dataverse System Administrator frequently has no visibility into, especially in larger orgs where CE administration and tenant licensing sit with different teams entirely.

That's the real reason **App Access Checker** earns a place in this workflow — not just that it's a diagnostic most admins don't know exists, but that it resolves a specific user's access per app from *inside* Dataverse, surfacing the licensing verdict without requiring Global Admin or License Admin rights to see it:

```
https://<yourorg>.crm.dynamics.com/WebResources/msdyn_AppAccessChecker.html
```

*There's a second way in, too: from the Power Platform admin center, open the environment, go to **Users**, select **See all** under Access, and you'll find a link straight into the same checker. It's a more discoverable path than the raw URL above if you don't already have it bookmarked.*

Log in as an admin, enter the affected user's UPN or email, and it evaluates the user's actual resolved access **per app**, returning:

- **Visible / Not Visible** — the bottom-line verdict for each app
- **Security** — whether the user has read privilege on the app module table (if not, *nothing* is visible, regardless of any other setting)
- **Licensing** — whether the user's current license actually covers that specific app

This matters because licensing doesn't show up as a "mismatch" in any side-by-side comparison of roles, teams, or security groups — it's a separate axis entirely, tied to the user's account rather than their Dataverse configuration, and it's the one axis a CE-only admin usually can't check directly on their own.

## The Root Cause

The checker flagged a **licensing issue** for this specific user. Everything else — role, team, BU, security — was correctly configured. The license simply wasn't provisioning access to that app. That got escalated to the global IT admin to correct at the tenant level, and the app access issue was resolved.

## Takeaways

- **Records access ≠ app access.** These are governed by different mechanisms in Dataverse, and it's easy to assume they travel together.
- **"Same role" doesn't always mean the same thing.** Business Unit scoping can make an identically-named role a different record entirely.
- **When visual comparison to a working peer runs out of leads, stop comparing and query the user's resolved state directly.** The App Access Checker does exactly that, and it will surface licensing problems that no amount of role/team auditing will show you.
- Bookmark `https://<yourorg>.crm.dynamics.com/WebResources/msdyn_AppAccessChecker.html` — it's one of the fastest first-line diagnostics for this exact class of issue, and it works even when you don't have visibility into the tenant's licensing yourself.

---
