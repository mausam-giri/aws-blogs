---
title: "Serverless on AWS"
description: "11-phase walkthrough for SAM, Lambda, API Gateway, EventBridge, and Application Auto Scaling."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
weight: 50
bookCollapseSection: true
tags:
  - lambda
  - sam
  - apigateway
  - eventbridge
  - sqs
  - dynamodb
  - autoscaling
  - serverless
  - walkthrough
related:
  - posts/aws-lambda-cicd
  - examples/lambda-event-pipeline
  - examples/serverless-snippets
  - guides/orderflow-aws
---

> Build and operate an event-driven serverless order pipeline with AWS SAM — Lambda, HTTP API, EventBridge, SQS, DynamoDB, and safe deployments.

**Code samples:** [Lambda event pipeline]({{< relref "examples/lambda-event-pipeline" >}}) · [Serverless snippets]({{< relref "examples/serverless-snippets" >}}) · [IAM policies]({{< relref "examples/iam-policies" >}})

## What you build

A minimal **order events** system:

1. **Producer API** accepts orders and publishes `OrderCreated` to EventBridge
2. **SQS + worker Lambda** processes messages and writes to DynamoDB
3. **Analytics Lambda** (optional) persists events to RDS for reporting
4. **SAM** packages and deploys everything; **CodeDeploy** canaries production releases

## Architecture

```mermaid
flowchart LR
    Client[Client] --> API[HTTP API]
    API --> Prod[Producer Lambda]
    Prod --> EB[EventBridge]
    EB --> SQS[SQS Queue]
    SQS --> Worker[Worker Lambda]
    Worker --> DDB[(DynamoDB)]
    EB --> Analytics[Analytics Lambda]
    Analytics --> RDS[(RDS)]
```

## Phases

| Phase | Topic |
|-------|-------|
| 01 | [SAM Project Setup]({{< relref "01-sam-project-setup" >}}) — init, structure, globals |
| 02 | [Lambda Functions]({{< relref "02-lambda-functions" >}}) — handlers, roles, env vars |
| 03 | [HTTP API Gateway]({{< relref "03-http-api-gateway" >}}) — routes, CORS, auth |
| 04 | [EventBridge]({{< relref "04-eventbridge" >}}) — rules, targets, event schema |
| 05 | [SQS and Lambda Triggers]({{< relref "05-sqs-lambda-triggers" >}}) — queues, DLQ, batching |
| 06 | [DynamoDB]({{< relref "06-dynamodb" >}}) — table design, IAM, access patterns |
| 07 | [SAM Build and Deploy]({{< relref "07-sam-build-deploy" >}}) — build, local test, guided deploy |
| 08 | [Versions and Concurrency]({{< relref "08-versions-concurrency" >}}) — aliases, reserved concurrency |
| 09 | [Application Auto Scaling]({{< relref "09-application-auto-scaling" >}}) — ECS, DynamoDB, custom metrics |
| 10 | [CI/CD with CodeDeploy]({{< relref "10-cicd-codedeploy" >}}) — pipeline, canary, rollback |
| 11 | [Observability and Operations]({{< relref "11-observability-operations" >}}) — logs, alarms, runbook |

**See also:** [OrderFlow on AWS]({{< relref "guides/orderflow-aws" >}}) (EKS variant of the same event pattern) · [Lambda CI/CD post]({{< relref "posts/aws-lambda-cicd" >}})
