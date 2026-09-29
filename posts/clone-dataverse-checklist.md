# What to Expect When You're Expecting to Clone Dataverse

The request came in as a single line.

*"Can we get a copy of production in the lower environment for the last 12 months data only?"*

No requirements doc, no follow-up questions. The system was live, the users were settled, and now they wanted somewhere to play: a sandbox that looked and behaved like the real thing, with no risk of breaking it. Perfectly reasonable. I had been part of the go-live migration, so I thought I knew what I was signing up for.

I didn't.

A go-live migration pushes data into something empty and waiting. A refresh pushes it into an environment that is already wired to the world, with flows that fire on a schedule, endpoints that point somewhere real, and Azure resources that have to exist before the first record lands. And that closing phrase, *"for the last 12 months only"*, turned a copy into a design exercise.

Behind that one line sat a quiet list of questions nobody had asked yet.

This post is that list.

## The order I'd run it in now

Nine checks in three phases, plus a document migration checklist if files are in scope. The order matters. Data writes trigger logic and timers fire on the clock, so the safety work has to be in place **before** the first record lands, not after.

#### First and foremost, ask yourself two key architectural questions:
1. Are you provisioning a brand-new environment, or migrating into an existing target?
2. Will you redeploy solutions from scratch, or leverage a minimal copy of Production?

Your available tenant storage capacity will play a major role in this decision.

#### Key Optimization Tips:

**Protect Production Performance:** Develop and test your migration packages against a temporary Dataverse sandbox copied from Production. This isolates workload overhead and prevents performance degradation for live users.

**Scale for Data Throughput:** If using SQL (as another source used in migration, I had Azure SQL in this case), temporarily scale up its vCore compute capacity to maximize load speeds during ingestion.

## Phase 1: Before you press anything

### 1. Scope the window: what does "the last 12 months" actually mean?

**Native copy can't filter by date.** The admin center and `pac admin copy` offer two levels: *Everything* (`FullCopy`) or *Customizations and schemas only* (`MinimalCopy`). Neither takes a date range. A time-boxed request therefore means a minimal copy, which brings users, customizations and schema across, followed by a data load you control. That load can be SSIS with KingswaySoft, Azure Data Factory, or your own code against the SDK or Web API.

Then split your tables into two groups:

- **Core (foundation) tables:** the records everything else hangs off, such as accounts, contacts and reference data. Migrate these **in full**, whatever their created date.
- **Auxiliary tables:** the transactional records that reference the core, such as activities, cases and notes. Apply the time-window filter **here only**.

The reason is referential integrity. Filter the parents by date and every in-window child ends up pointing at a parent that was left behind. Which tables count as core is a judgement call, so agree the list with the client and write it down.

The extract for an auxiliary table then looks like this:

```xml
<fetch>
  <entity name="incident">
    <all-attributes />
    <filter>
      <condition attribute="createdon" operator="ge" value="2025-10-01" />
    </filter>
  </entity>
</fetch>
```

Pin down these points before you build the load:

- **Load order:** users and teams first (the minimal copy already brings users), then core tables, then auxiliary tables, then many-to-many relationship tables last.
- **Cross-window lookups:** an in-window record can reference an out-of-window one in another auxiliary table. Decide whether to pull that record in or leave the lookup empty.
- **Filter on `createdon`, and check how go-live populated it.** `modifiedon` changes on every update, so it selects a different and more volatile set. And if the go-live load did not use `overriddencreatedon` (see point 8), every migrated legacy record carries the go-live date, so a 12-month filter keeps or drops all of that history as one block.
- **A real cut-off date:** "the last 12 months" is relative. Pick an explicit UTC date and put it in the runbook.
- **Preserve source GUIDs.** Dataverse lets you supply the primary key on create. Doing so means lookups resolve without a mapping table and reconciliation becomes a straight key comparison.
- **Expect throttling.** Service protection limits return `429` with a `Retry-After` header. Honour it, use bulk messages such as `CreateMultiple` or `UpsertMultiple` where your tool supports them, and spread the load across several application users.

<!-- ANECDOTE SLOT (time window): what you hit when you applied the 12-month filter, e.g. a lookup that pointed outside the window, or the core vs auxiliary discussion with the client. -->

### 2. Match solution versions

**A sandbox on different solution versions behaves differently to production**, and then testers report bugs that don't exist in prod or miss ones that do. Run `pac solution list` against the source and the target, and compare version and managed/unmanaged state for every solution.

Look beyond the version number:

- **Unmanaged layers** sitting on top of managed components change behaviour without changing a version.
- **A half-finished stage-and-upgrade** (an `_Upgrade` holding solution) in production is state you will inherit.
- **Loose components:** Microsoft notes that components which were never added to a solution (canvas apps, flows, custom connectors, connections) might not come across, so validate them after the copy.

Repeat the comparison after the copy finishes. A copy also overwrites the target, so confirm nothing unreleased is sitting in it that someone still needs.

### 3. Line up the Azure resources early

**A Dataverse copy stops at Dataverse.** Blob Storage, Azure Functions and Azure SQL are not copied. If your solution depends on them, the lower environment is broken until equivalent resources exist.

They also have lead time, because they need the client (subscription, approvals, cost). And they must be separate from the production ones: a lower environment writing into production storage is the same mistake as pointing at a live endpoint. Where to look for dependencies:

- Plugin assemblies and custom APIs that call Functions or write to Blob Storage
- Service endpoint and webhook registrations (Service Bus, Event Hub, HTTP)
- Secret-type environment variables backed by Azure Key Vault, where the lower environment needs its own vault or its own access
- Virtual table providers that read from Azure SQL

Send the client this list before the copy, not after something fails in UAT.

### 4. Count your databases

**"Dataverse to Dataverse" is only true if you have no virtual tables.** The table definitions travel with the environment, but the rows never lived in Dataverse, so they are not copied. In the lower environment those tables either still point at the production source or point at nothing.

The thing to repoint is the virtual table's data source record. Decide per table: point it at a non-production source (another resource to provision, see point 3), or leave it out. Your time-window load won't touch these tables either, so their data is whatever the source system says it is.

## Phase 2: Lock the environment down before any data lands

Put the target into administration mode and leave background operations disabled until points 5 to 7 are done. Microsoft's own guidance for an Everything copy follows the same order: make the changes that protect production's external services first, then turn off administration mode and enable background operations.

### 5. Repoint or retire every integration endpoint

**Anything that stores an address still stores production's.** Check:

- Environment variables (data source and secret types)
- Connection references and the connections behind them
- Custom connectors (host and base URL)
- Service endpoint and webhook registrations
- Plugin step secure and unsecure configuration
- Config tables and JavaScript web resources

For each integration, pick one of three:

- Point it at the other system's non-production endpoint.
- Stub it.
- Switch it off, because the lower environment doesn't need it.

The rule of thumb is that nothing in a lower environment should be able to reach a live system. If the integration writes back, the other system may need its own refresh or migration too, otherwise it receives updates for records it has never seen. Connections may not come across either, so re-authenticate them deliberately with lower-environment accounts.

<!-- ANECDOTE SLOT (integrations): an endpoint, connection or config value that still pointed at live, or an integration you decided to switch off. -->

### 6. Decide what stays off

**Automation fires when data is written, and a load is a lot of data being written.** Inventory your classic workflows, cloud flows, business rules and plugin steps, and switch them off before the load.

Entity-scoped business rules belong at the top of the list. They run server-side on every write, including the ones your load makes, and can set or clear values on the way in. That means they can quietly change the data you are trying to copy faithfully.

For plugins and workflows, Dataverse also lets the load itself opt out:

- `BypassBusinessLogicExecution` with `CustomSync`, `CustomAsync` or both skips custom synchronous and asynchronous logic. The calling user needs the `prvBypassCustomBusinessLogic` privilege, and `BypassBusinessLogicExecutionStepIds` lets you skip specific plugin steps only.
- `SuppressCallbackRegistrationExpanderJob` stops the load from triggering Power Automate flows. Flow owners are not notified that their logic was bypassed.

The Web API accepts these as `MSCRM.`-prefixed headers. Bypassing is what you want here, because you are copying the values production already computed, not recomputing them. But treat it as a second line of defence. The documentation describes bypassing plugins and workflows, so keep entity-scoped business rules as their own item on the off list rather than assuming the parameters cover them. Turn everything back on one item at a time, deliberately, once the endpoints are safe.

### 7. Timer triggers: avoid the window

**Timers don't need data or users to fire, only the clock.** They will run whether or not anyone is testing, and they are the ones you won't catch by watching the load. Where to find them:

- Cloud flows with a recurrence trigger. Cloud flows live in the `workflow` table (category 5), so you can query it and search `clientdata` for `Recurrence`, instead of clicking through every solution.
- Scheduled classic workflows.
- Recurring system jobs such as bulk delete and duplicate detection.
- Jobs outside Dataverse that target the environment URL: Azure Functions with timer triggers, Logic Apps recurrences, SSIS or agent jobs.

Some of them may legitimately need to run in the lower environment. My preference is to avoid the timer window altogether: plan the refresh and the hand-over so the environment stays switched off across any scheduled run time, rather than trusting each timer to be harmless. List every timer-triggered item with its schedule before you start, then re-enable them deliberately, in order.

<!-- ANECDOTE SLOT (timers): a scheduled item you caught, or nearly missed. -->

## Phase 3: While the data moves

### 8. Preserve created-on with `overriddencreatedon`

**`createdon` belongs to the platform, so a load stamps every record with the moment it was inserted.** Load 12 months of history on a Tuesday and, unless you intervene, all of it says it was created on Tuesday. The supported way around this is the `overriddencreatedon` column (*Record Created On*). Supply the source `createdon` value in it when you create the record, and the platform stores that value as `createdon` and keeps the real insert timestamp in `overriddencreatedon`.

```http
POST [Organization URI]/api/data/v9.2/accounts

{
  "accountid": "<source GUID>",
  "name": "Contoso Ltd",
  "overriddencreatedon": "2025-03-14T09:22:41Z"
}
```

Why it matters:

- **Your windowing logic depends on it.** The whole exercise selected records by `createdon`. If the target restarts every row at load time, the next delta load, refresh or reconciliation can't tell old from new.
- **Age-driven behaviour only reproduces if the ages do.** Views and charts filtered on "created in the last 30 days", SLA and ageing calculations, retention and bulk delete jobs, dashboards, Power BI reports and automations with date conditions all read `createdon`.
- **Testing realism.** A playground where every record was created today is not a mirror of production.
- **Load provenance.** The real insert time survives in `overriddencreatedon`, which helps you separate loaded rows from records your testers create afterwards.

Things to know before you rely on it:

- **It is write-on-create.** There is no update route to correct it afterwards, so a wrong load means delete and reload. Load a small batch first and check the result in a view.
- **Not every table has it.** Check the metadata for each table in scope.
- **Send UTC.** ETL tools can convert time zones quietly, so verify a sample against the source.
- **`modifiedon` has no equivalent.** It will show load time. Decide with the client whether they need it, and document that `modifiedon` reflects load time if not.

### 9. Mask before anyone logs in

**A refresh puts production personal data in an environment with a wider audience and weaker governance.** More people have access, there are fewer controls, and GDPR does not relax because the environment is called a sandbox.

Masking here means changing the stored values. Column-level masking on secured columns only changes what a user sees, so it does not qualify. If you load with an ETL tool, mask in flight so unmasked data never lands in the target. Otherwise mask straight after the load and keep the environment in administration mode until it is done.
You can agree with the client on the masking roles. In this case, we had the masking roles done on-the-fly via SSIS.

How to mask well:

- **Deterministic:** the same input gives the same output, so duplicates, joins and duplicate detection behave consistently.
- **Format-preserving:** email shape, phone length and postcode patterns still pass validation and input masks.
- **Unique where it needs to be:** a column that is part of an alternate key must still be unique after masking.
- **Complete:** cover the obvious columns (names, emails, phones, addresses, identifiers) and the easy-to-forget ones: free-text notes, email bodies and attachments.

Email addresses deserve special care. A real customer address plus an active automation is how a test sends a real email. Mask them to a reserved domain such as `example.invalid`, and confirm mailboxes are disabled in the target.

## If documents are in scope: a migration checklist

Documents don't live in one place, and each store has its own limits:

| Store | Where the file lives | Notes |
|---|---|---|
| Notes | `annotation.documentbody` | Base64 string. Default limit 5 MB, configurable up to 128 MB |
| Email attachments | `activitymimeattachment.body` | Same as notes |
| File columns | Dataverse file storage | Up to 10 GB per column. Use the block upload messages for large files |
| SharePoint | Document location records pointing at a site and library | The files are not in Dataverse at all |

**Capacity and limits**

- [ ] Target file capacity checked against the size estimate for the windowed set
- [ ] Maximum file size setting aligned with the source. Base64 adds roughly a third to the size on top of the file itself
- [ ] Large files chunked: `InitializeFileBlocksUpload`, `UploadBlock`, `CommitFileBlocksUpload` for file columns

**Load mechanics**

- [ ] `filename`, `mimetype` and `documentbody` (or `body`) loaded together in the same operation
- [ ] Source GUIDs preserved and the parent link (`objectid` and `objecttypecode`) resolves
- [ ] `overriddencreatedon` set on notes and attachments too
- [ ] Parents loaded before their notes and attachments
- [ ] Email activities migrated as completed, not draft, and mailboxes disabled in the target so a document load can't trigger real mail

**SharePoint**

- [ ] Lower SharePoint site and libraries provisioned
- [ ] Document location records repointed, and never left on production libraries
- [ ] Library content copied for the same window with the folder structure preserved, or dummy content agreed with the client
- [ ] Nothing in the lower site can write to production libraries

**Verification**

- [ ] File count and total size reconciled per parent table, source against target
- [ ] A sample of files opened and hash-compared with the source
- [ ] Orphan check: no notes or attachments without a parent, no document locations with dead links

## The full checklist

- [ ] Cut-off date agreed as an explicit UTC date; core and auxiliary tables classified
- [ ] Source GUIDs preserved; load spread across application users and throttling handled
- [ ] Solution versions, managed state and unmanaged layers compared before and after the copy
- [ ] Azure dependencies listed and provisioned, separate from production
- [ ] Virtual tables identified, with a source decided for each
- [ ] Target in administration mode with background operations disabled
- [ ] Every stored endpoint reviewed: repoint, stub or disable
- [ ] Automation inventoried, entity-scoped business rules first; bypass parameters set on the load
- [ ] Timer-triggered items listed with their schedules, window avoided
- [ ] `overriddencreatedon` populated from the source `createdon`, in UTC, and verified on a small batch
- [ ] Masking plan covers structured fields, free text and email addresses
- [ ] Counts reconciled per table and per month created
- [ ] Administration mode turned off and background operations enabled only after all of the above

## Closing thought

The copy itself is the easy part: a button and a wait. The job is the set of questions behind the button. Next time a request arrives as a single line, I'll ask for the list before I ask for the environment name.

## References

- Microsoft Learn: [Copy an environment](https://learn.microsoft.com/power-platform/admin/copy-environment)
- Microsoft Learn: [pac admin copy](https://learn.microsoft.com/power-platform/developer/cli/reference/admin)
- Microsoft Learn: [Bypass custom Dataverse logic](https://learn.microsoft.com/power-apps/developer/data-platform/bypass-custom-business-logic)
- Microsoft Learn: [Optional parameters](https://learn.microsoft.com/power-apps/developer/data-platform/optional-parameters)
- Microsoft Learn: [Use file data with Attachment and Note records](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/annotation-note-entity)
- Nishant Rana: [Using overriddencreatedon to set Created On](https://nishantrana.me/2018/10/16/using-overriddencreatedon-or-record-created-on-field-to-update-created-on-field-in-dynamics-365/)
- Nishant Rana: [Preserving modifiedon during data migration](https://nishantrana.me/2026/04/15/preserving-modifiedon-during-data-migration-in-dynamics-365-dataverse/)
