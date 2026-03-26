# Recycle Bin in Dataverse: native RecycleBinConfig vs the XrmToolBox plugin

For years, if a user accidentally deleted a record in Dataverse, your recovery options were: restore from backup (painful, requires admin, restores the whole environment), use the XrmToolBox Recycle Bin plugin (community tool, great but unofficial), or just accept that it's gone.

Microsoft has finally shipped a native answer: `RecycleBinConfig`. Here's what it actually does, how it compares to the XrmToolBox approach, and when you should switch.

## What RecycleBinConfig gives you

`RecycleBinConfig` is a new Dataverse table that lets you configure soft-delete behaviour per table. When enabled on a table, deleted records are marked as soft-deleted and retained for a configurable period (up to 30 days) before permanent deletion.

```xml
<!-- Enable Recycle Bin for a table in your solution -->
<RecycleBinConfig>
  <IsRecycleBinEnabled>true</IsRecycleBinEnabled>
  <TableName>account</TableName>
</RecycleBinConfig>
```

End users can see and restore their own deleted records from the model-driven app. Admins can see all deleted records across the table. Recovery is self-service — no admin ticket, no backup restore.

## Enabling it via Power Platform CLI

```bash
# Check if feature is enabled on your environment
pac env list-settings --environment $ENV_ID | grep recycleBin

# Enable Recycle Bin on an environment
pac env update-settings \
  --environment $ENV_ID \
  --name IsRecycleBinEnabled \
  --value true
```

Once environment-level is enabled, configure per-table either in the UI (Table → Properties → Enable Recycle Bin) or by shipping a `RecycleBinConfig` record in your solution.

## How it compares to XrmToolBox

The XrmToolBox Recycle Bin plugin by Jonas Rapp has been the community standard for this for years. It works by intercepting audit logs and letting admins reconstruct deleted records.

| Feature | Native RecycleBinConfig | XrmToolBox Plugin |
|---|---|---|
| End-user self-service | ✅ Yes | ❌ Admin only |
| Supported by Microsoft | ✅ Yes | ⚠️ Community |
| Solution-deployable | ✅ Yes | ❌ Manual per environment |
| Works in GCC/Sovereign | ✅ Yes | ⚠️ Depends |
| Requires audit enabled | ❌ No | ✅ Yes |
| Restore related records | ⚠️ Partial | ✅ Better |
| Cost | ✅ Included | ✅ Free |

The native solution wins on self-service and supportability. XrmToolBox still wins on relationship reconstruction — if you deleted an account with 50 contacts and want them all back in the right state, the plugin handles that better today.

## When to switch

Switch to native if:

- Your users want self-service recovery without raising a ticket
- You're in a regulated environment where community tools need formal approval
- You want this in your solution and deployed through your ALM pipeline

Keep XrmToolBox if:

- You need to restore complex record relationships intact
- You're on an older environment version that doesn't support `RecycleBinConfig` yet
- You have existing admin processes built around the plugin

## One gotcha

The 30-day retention window is per-environment and applies to **all** tables where Recycle Bin is enabled. There's currently no per-table retention override. If you enable it on a high-volume table (like a custom transaction log table), you'll want to think about storage implications before rolling out broadly.

Check storage consumption in the Power Platform admin center before enabling on large tables.

---

This is a case where Microsoft caught up to the community tool in the right way — self-service, solution-deployable, and supported. If you're starting fresh, go native. If you have existing processes, plan the migration properly rather than switching cold.
