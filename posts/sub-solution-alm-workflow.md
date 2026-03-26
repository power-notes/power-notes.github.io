# Sub-solution workflows: avoiding merge chaos in Dataverse

If you've been doing ALM on Power Platform for more than six months, you've hit the merge problem. Two developers promoting components into the same solution, Azure DevOps pipelines colliding, and a `solution.xml` diff that reads like a war crime.

The fix isn't a better branching strategy. It's a better solution structure.

## One main solution, many sub-solutions

The pattern I've landed on: one **main solution** tied to your Azure DevOps pipeline, and individual developer sub-solutions that feed into it. Developers work in their own sandbox, then promote components — not entire solutions — before raising a PR.

Here's what that looks like structurally:

```text
Main Solution  (DEV → UAT → PROD)
  └── owned by the team, tracked in Azure DevOps

Developer Sub-Solutions
  ├── Sub_YourNameSandbox
  ├── Sub_Dev2Sandbox
  └── Sub_Dev3Sandbox
       └── components promoted to Main before PR
```

This means the main solution's `solution.xml` is only touched at promotion time, not during active development. Merge conflicts drop to near zero.

## Promoting components via CLI

Once a developer is ready, they use the Power Platform CLI to add their components to the main solution — no manual UI clicking, no accidental additions.

```bash
# Install Power Platform CLI tools task in your pipeline
pac auth create \
  --url https://yourorg.crm.dynamics.com \
  --applicationId $APP_ID \
  --clientSecret $CLIENT_SECRET \
  --tenant $TENANT_ID

# Export and unpack a developer's sub-solution
pac solution clone \
  --name Sub_YourNameSandbox \
  --outputDirectory ./exported
```

After promoting components, the developer exports the main solution, commits the unpacked files, and raises the PR against `main`. The pipeline handles the rest.

## The Azure DevOps pipeline

Your build pipeline does three things: export, unpack, and run Solution Checker. Nothing exotic.

```yaml
trigger:
  branches:
    include:
      - main

steps:
  - task: PowerPlatformToolInstaller@2
    displayName: 'Install Power Platform CLI'

  - task: PowerPlatformExportSolution@2
    displayName: 'Export main solution'
    inputs:
      authenticationType: PowerPlatformSPN
      PowerPlatformSPN: $(ServiceConnection)
      SolutionName: YourMainSolution
      SolutionOutputFile: $(Build.ArtifactStagingDirectory)/solution.zip
      Managed: false

  - task: PowerPlatformUnpackSolution@2
    displayName: 'Unpack solution'
    inputs:
      SolutionInputFile: $(Build.ArtifactStagingDirectory)/solution.zip
      SolutionTargetFolder: $(Build.SourcesDirectory)/solutions/main

  - task: PowerPlatformChecker@2
    displayName: 'Solution Checker'
    inputs:
      authenticationType: PowerPlatformSPN
      PowerPlatformSPN: $(ServiceConnection)
      FilesToAnalyze: $(Build.ArtifactStagingDirectory)/solution.zip
```

## Why not environment-per-developer?

You could. But environments scale license costs linearly with team size, and you're still dealing with solution-level merges if two people touch the same component. Sub-solutions within a shared dev environment is cheaper, simpler, and the merge surface is smaller because you're moving components — not entire solution zips.

> The licensing cost argument wins every architectural debate in the real world. Ideal patterns are only ideal if you can afford them.

## The one caveat

This pattern assumes developers have the discipline to work in their own sub-solutions and not directly in the main solution. That's a process problem, not a technical one. Lock down the main solution with publisher prefix conventions and document the workflow clearly.

The pattern holds at 3 developers. I'd revisit it past 10.
