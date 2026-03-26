# Power Platform vs Custom Development: how to make the right call

Every enterprise project eventually lands the same debate in the room. The business wants it fast. The IT team wants it maintainable. The architect wants it scalable. And someone — usually the person who's been burned before — asks the question nobody wants to sit with:

**Should we build this on Power Platform, or go custom?**

There's no universal answer. But there is a framework. And after running this decision across dozens of projects, here's how I actually think about it.

---

## Why this decision is harder than it looks

The surface-level comparison is tempting: Power Platform is faster and cheaper up front, custom development is more flexible and scalable. Pick your poison.

The reality is more nuanced. Power Platform has matured significantly — Dataverse is a serious enterprise data platform, model-driven apps handle genuinely complex UX, Power Automate can orchestrate multi-system workflows at scale. Meanwhile, custom development isn't automatically "more powerful" — it's more expensive to build, harder to maintain, and only as good as the team that writes it.

The wrong decision in either direction costs real money. A Power Platform solution that hits its ceiling 18 months in costs a rewrite. A custom application built for a workflow that changes quarterly costs a full-time developer to maintain.

---

## The five questions that actually matter

### 1. Who owns this long-term?

This is the question most architects skip, and it's the most important one.

If the solution will be maintained by a functional consultant or a business analyst — Power Platform. If it will be owned by a .NET development team with a mature CI/CD culture — custom is viable.

The best architecture is the one your team can actually maintain under pressure at 11pm when something breaks in production.

### 2. How stable is the business process?

Power Platform shines on **stable, well-understood processes**. Approval workflows, case management, field service, sales pipelines — these map cleanly onto Dataverse tables, model-driven apps, and Power Automate flows.

Custom development earns its cost when the **process is genuinely complex or novel** — multi-variable pricing engines, real-time computational logic, custom ML inference, or UX patterns that don't fit the model-driven paradigm.

> If the business can describe the process in a flowchart today, Power Platform can probably build it. If the process requires an algorithm, lean toward custom.

### 3. What are the integration requirements?

Power Platform has over 1,000 connectors. For most enterprise SaaS integrations — Salesforce, SAP (via OData), SharePoint, Teams, Outlook, ServiceNow — it's well covered.

The gaps appear at:
- **Real-time, high-volume event streaming** (Kafka, Event Hubs at scale)
- **Legacy on-premise systems** with no REST API and no connector
- **Complex transformation logic** that would require dozens of nested Power Automate conditions

For these, Azure Functions or Logic Apps with custom connectors bridge the gap — you don't have to choose between Power Platform and Azure, you can use both.

### 4. What does the licensing actually cost?

This is where idealistic architecture meets reality.

A model-driven Power App requires a **Power Apps per-user licence** (currently ~$20/user/month) or a **per-app licence** ($5/user/app/month). At 500 users, that's $10,000/month just in licensing before you write a line of code.

A custom .NET application hosted on Azure App Service might cost $200–500/month in infrastructure, plus development time. At scale, custom can be cheaper to run — but never forget the build and maintenance cost on the other side of that equation.

Always model the **5-year total cost of ownership**, not just the build cost. Include licences, maintenance, and the cost of change requests.

```text
Power Platform TCO (500 users, 3 apps, 5 years):
  Licensing:    500 × $5 × 3 apps × 60 months = $450,000
  Build:        3 months × 2 consultants        =  $90,000
  Maintenance:  0.5 FTE × 5 years               = $200,000
  Total:                                         = $740,000

Custom TCO (500 users, 3 apps, 5 years):
  Build:        12 months × 3 developers         = $540,000
  Hosting:      $500/month × 60 months           =  $30,000
  Maintenance:  1 FTE × 5 years                  = $400,000
  Total:                                         = $970,000
```

These are illustrative — your numbers will differ. But model them. Every time.

### 5. What are the compliance and data residency requirements?

Dataverse stores data in Microsoft-managed Azure regions. For most enterprise scenarios, this is fine — Microsoft holds extensive compliance certifications (ISO 27001, SOC 2, GDPR, HIPAA).

Custom development gives you full control over where data lives and how it's handled. For organisations with strict data sovereignty requirements, air-gapped environments, or sensitive regulated data that cannot touch a shared cloud platform — custom or private cloud is often the mandate, not the choice.

---

## The decision matrix

| Scenario | Recommended approach |
|---|---|
| Internal productivity tool, stable process | ✅ Power Platform |
| Complex UX, novel interaction patterns | ✅ Custom |
| Multi-system workflow automation | ✅ Power Automate |
| Real-time data processing at high volume | ✅ Custom / Azure |
| Case management, field service, sales ops | ✅ Power Platform |
| Public-facing customer portal | ⚠️ Power Pages or Custom |
| Regulated data, strict sovereignty | ✅ Custom |
| Small team, limited developer resource | ✅ Power Platform |
| Large user base, licensing cost is a constraint | ✅ Custom |
| Needs deep Office 365 integration | ✅ Power Platform |

---

## The hybrid answer nobody talks about enough

The real-world answer is rarely "Power Platform OR custom." It's usually **both, with clear boundaries**.

A pattern I've used successfully on several large engagements:

```text
Dataverse          ← single source of truth for business data
Model-driven app   ← internal user interface (80% of users)
Power Automate     ← workflow and notification orchestration
Azure Function     ← complex business logic, heavy computation
Custom .NET API    ← public-facing endpoints, third-party integrations
Power BI           ← reporting and analytics layer
```

Each layer does what it's best at. The skill is drawing the boundaries clearly — and documenting why, so the team in 18 months doesn't accidentally rebuild what you already built.

---

## The honest summary

Power Platform wins when:
- The process fits the platform's model
- The team leans functional over developer
- Speed-to-value matters more than theoretical flexibility
- You're deep in the Microsoft 365 ecosystem already

Custom wins when:
- The process is genuinely novel or computationally complex
- Licensing cost at scale exceeds build cost
- Data sovereignty or compliance rules out shared cloud
- The UX requirements are outside what model-driven or canvas can deliver

The worst outcome isn't picking the wrong tool. It's picking the wrong tool for the wrong reasons — choosing Power Platform because "it's faster" without modelling the licensing cost, or choosing custom because "it's more powerful" without accounting for who maintains it.

Make the decision with your eyes open. Model the numbers. Name the trade-offs. Then commit.
