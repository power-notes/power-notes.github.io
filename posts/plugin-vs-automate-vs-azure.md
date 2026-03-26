# Dataverse Plugin vs Power Automate vs Azure Function: the decision framework

Every time a new extensibility requirement lands, someone on the team will have a strong opinion about which tool to use. The plugin advocate will say plugins. The low-code enthusiast will say Power Automate. The Azure developer will reach for Functions.

Here's the framework I use to cut through that — no vendor bias, just the actual trade-offs.

## The three-question filter

Before anything else, answer these three questions:

1. **Is it synchronous?** Does the caller need to wait for a result, or can this fire-and-forget?
2. **Is it within Dataverse?** Does the logic need direct access to the execution context — pre/post images, the transaction pipeline?
3. **What's the maintenance model?** Who owns this long-term, and what's their skill set?

Your answers almost always point you somewhere specific.

## When to use a Dataverse Plugin

Plugins are the right choice when you need **synchronous execution inside the transaction**. If you need to:

- Validate data before it's written and throw a blocking error
- Calculate a field value based on pre-image data
- Run logic that must succeed or fail with the record save

```csharp
public class AccountValidationPlugin : IPlugin
{
    public void Execute(IServiceProvider serviceProvider)
    {
        var context = (IPluginExecutionContext)
            serviceProvider.GetService(typeof(IPluginExecutionContext));

        if (context.MessageName != "Create") return;

        var target = (Entity)context.InputParameters["Target"];
        var revenue = target.GetAttributeValue<Money>("revenue");

        if (revenue?.Value < 0)
        {
            throw new InvalidPluginExecutionException(
                "Annual revenue cannot be negative.");
        }
    }
}
```

**The downside**: plugins require a .NET developer, solution deployment, and ILMerge or NuGet management for dependencies. They're invisible in the UI and hard to debug without Plug-in Registration Tool or XrmToolBox.

## When to use Power Automate

Power Automate is the right choice when the logic is **asynchronous, conditional, and involves multiple systems**. Good fit for:

- Sending emails or Teams notifications after a record changes
- Syncing data to a third-party system (async is fine)
- Approval workflows and human-in-the-loop processes
- Anything a pro-dev doesn't need to own long-term

```text
Trigger: When a row is added/modified/deleted
  → Condition: Status = Active AND Revenue > 1,000,000
    → True: Post to Teams channel
    → True: Create task in Planner
    → False: Do nothing
```

**The downside**: Power Automate is opaque at scale. Flows owned by individual users are a governance disaster. Service accounts, connection references, and environment variables are non-negotiable if you're doing this seriously.

## When to use Azure Functions

Azure Functions are the right choice when you need **complex logic, external dependencies, or performance at scale** — and the trigger doesn't need to be synchronous with Dataverse.

Typical use cases:
- Heavy computation that would time out in a plugin (2-minute limit)
- Calling external APIs with retry logic and circuit breakers
- Processing large datasets or file operations
- Multi-tenant or cross-environment logic

```csharp
[FunctionName("ProcessLargeDataset")]
public async Task<IActionResult> Run(
    [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequest req,
    ILogger log)
{
    var body = await new StreamReader(req.Body).ReadToEndAsync();
    var payload = JsonSerializer.Deserialize<ProcessingPayload>(body);

    // Long-running work that would kill a plugin
    var results = await _processor.RunAsync(payload, CancellationToken.None);

    return new OkObjectResult(results);
}
```

**The downside**: Azure Functions require Azure infrastructure, monitoring setup, and a developer who understands retry policies, cold starts, and deployment slots. The operational overhead is real.

## The decision matrix

| Criteria | Plugin | Power Automate | Azure Function |
|---|---|---|---|
| Synchronous | ✅ Yes | ❌ No | ❌ No |
| Inside Dataverse transaction | ✅ Yes | ❌ No | ❌ No |
| Low-code friendly | ❌ No | ✅ Yes | ❌ No |
| External API calls | ⚠️ Possible | ✅ Yes | ✅ Yes |
| Long-running work | ❌ No | ⚠️ Limited | ✅ Yes |
| Governance at scale | ✅ Good | ⚠️ Needs care | ✅ Good |

## The real-world tiebreaker

If you're still unsure after that matrix, apply this: **who needs to maintain this in 18 months?**

If the answer is "a pro-dev on the team" — plugin or Azure Function depending on sync requirements.

If the answer is "a functional consultant or power user" — Power Automate, with proper connection references and service account ownership from day one.

The best extensibility pattern is the one your team can actually maintain under pressure.
