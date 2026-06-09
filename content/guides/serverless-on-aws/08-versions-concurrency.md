---
title: "Versions and Concurrency"
description: "Serverless walkthrough — publish versions, aliases, reserved concurrency."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - lambda
  - deployment
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 80
related:
  - guides/serverless-on-aws
  - posts/aws-lambda-cicd
---

## Objective

Prepare Lambda functions for safe releases: **published versions**, a **prod alias**, and optional **reserved concurrency** to protect downstream systems.

## Architecture

```
$LATEST (dev only)
  → publish-version → v1, v2, ...
  → alias prod → points to v2
  → CodeDeploy shifts traffic prod: v1 → v2 (Phase 10)
```

## Commands

```bash
FUNC=order-serverless-ProducerFunction

aws lambda publish-version --function-name $FUNC
aws lambda create-alias \
  --function-name $FUNC \
  --name prod \
  --function-version 1

# Reserved concurrency (cap max parallel executions)
aws lambda put-function-concurrency \
  --function-name $FUNC \
  --reserved-concurrent-executions 50

# Provisioned concurrency (optional, low-latency steady load)
aws lambda put-provisioned-concurrency-config \
  --function-name $FUNC \
  --qualifier prod \
  --provisioned-concurrent-executions 5
```

## Manifests

### SAM `AutoPublishAlias` (simplifies versioning)

```yaml
ProducerFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: app.lambda_handler
    CodeUri: src/producer/
    AutoPublishAlias: prod
    DeploymentPreference:
      Type: Canary10Percent5Minutes
```

> `DeploymentPreference` requires CodeDeploy setup — detailed in Phase 10.

## Verification

```bash
aws lambda list-versions-by-function --function-name $FUNC
aws lambda get-alias --function-name $FUNC --name prod
aws lambda get-function-concurrency --function-name $FUNC
```

## Troubleshooting

### Alias still on old version after deploy

`AutoPublishAlias` creates new versions on deploy but CodeDeploy controls traffic shift. Check deployment status in CodeDeploy console.

### Throttling despite low traffic

Account-level concurrency limit (1000 default) or reserved concurrency on **other** functions can starve this function — review account concurrency dashboard.

## Lessons learned

- Never point production API integrations at **$LATEST** — always use an **alias**.
- Reserve concurrency on **workers** to prevent DynamoDB or RDS overload during spikes.

---
← [Previous: SAM Build and Deploy]({{< relref "07-sam-build-deploy" >}})  [Next: Application Auto Scaling]({{< relref "09-application-auto-scaling" >}}) →
