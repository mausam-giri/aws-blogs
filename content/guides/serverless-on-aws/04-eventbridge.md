---
title: "EventBridge"
description: "Serverless walkthrough — rules, SQS targets, and OrderCreated event schema."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - eventbridge
  - sqs
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 40
related:
  - guides/serverless-on-aws
  - examples/lambda-event-pipeline
  - guides/orderflow-aws/15-roadmap
---

## Objective

Route `OrderCreated` events from the default bus to an **SQS queue** (and optionally an analytics Lambda) using EventBridge rules with explicit `eventPattern` filters.

## Architecture

```
Producer PutEvents
  → default event bus
  → Rule: OrderCreatedRule
      ├── Target: OrderQueue (SQS)
      └── Target: AnalyticsFunction (optional)
```

## Commands

```bash
# After deploy — put a test event
aws events put-events --entries '[
  {
    "Source": "app.orders",
    "DetailType": "OrderCreated",
    "Detail": "{\"orderId\":\"test-1\",\"userId\":\"u1\",\"amount\":10,\"status\":\"CREATED\"}"
  }
]'

aws sqs get-queue-attributes --queue-url $QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages
```

## Manifests

```yaml
OrderQueue:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: order-events
    VisibilityTimeout: 60
    RedrivePolicy:
      deadLetterTargetArn: !GetAtt OrderDLQ.Arn
      maxReceiveCount: 3

OrderDLQ:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: order-events-dlq

OrderCreatedRule:
  Type: AWS::Events::Rule
  Properties:
    EventBusName: default
    EventPattern:
      source: [app.orders]
      detail-type: [OrderCreated]
    Targets:
      - Id: OrderQueueTarget
        Arn: !GetAtt OrderQueue.Arn

OrderQueuePolicy:
  Type: AWS::SQS::QueuePolicy
  Properties:
    Queues: [!Ref OrderQueue]
    PolicyDocument:
      Statement:
        - Effect: Allow
          Principal: { Service: events.amazonaws.com }
          Action: sqs:SendMessage
          Resource: !GetAtt OrderQueue.Arn
          Condition:
            ArnEquals:
              aws:SourceArn: !GetAtt OrderCreatedRule.Arn
```

### Event schema

| Field | Type | Example |
|-------|------|---------|
| `source` | string | `app.orders` |
| `detail-type` | string | `OrderCreated` |
| `detail.orderId` | string | UUID |
| `detail.userId` | string | `user-101` |
| `detail.amount` | number | `250` |
| `detail.status` | string | `CREATED` |

## Verification

```bash
aws events list-rules --event-bus-name default --name-prefix Order
aws sqs receive-message --queue-url $QUEUE_URL --max-number-of-messages 1
```

## Troubleshooting

### Rule matches but queue empty

Missing or incorrect **SQS queue policy** allowing `events.amazonaws.com`. The `aws:SourceArn` condition must match the rule ARN.

### Events on bus but rule not triggered

`eventPattern` is case-sensitive — `detail-type` must match `DetailType` from `put_events` exactly.

## Lessons learned

- Always attach a **DLQ** to the primary queue for poison messages.
- Use **input transformers** only when you need to reshape events — keep raw JSON for simpler workers.

---
← [Previous: HTTP API Gateway]({{< relref "03-http-api-gateway" >}})  [Next: SQS and Lambda Triggers]({{< relref "05-sqs-lambda-triggers" >}}) →
