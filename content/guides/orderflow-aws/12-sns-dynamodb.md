---
title: "SNS and DynamoDB"
description: "OrderFlow walkthrough — notifications topic and orderflow-events table."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - sns
  - dynamodb
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 120
related:
  - guides/orderflow-aws
  - examples/iam-policies
---

## Objective

Create **orderflow-notifications** (SNS) and **orderflow-events** (DynamoDB) — the worker publishes notifications and stores processed events (Phase 13).

## Architecture

```
Worker (Phase 13)
  → sns:Publish → orderflow-notifications
  → dynamodb:PutItem → orderflow-events (PK: eventId)
```

## Commands

### SNS topic

```bash
aws sns create-topic --name orderflow-notifications

export TOPIC_ARN=$(aws sns list-topics \
  --query "Topics[?contains(TopicArn, 'orderflow-notifications')].TopicArn" \
  --output text)

# Optional: email subscription for lab alerts
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint you@example.com
```

### DynamoDB table

```bash
aws dynamodb create-table \
  --table-name orderflow-events \
  --attribute-definitions AttributeName=eventId,AttributeType=S \
  --key-schema AttributeName=eventId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

aws dynamodb wait table-exists --table-name orderflow-events
```

### Worker IAM policy (preview — applied in Phase 13)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
      "Resource": "arn:aws:sqs:us-east-1:ACCOUNT_ID:orderflow-orders"
    },
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "TOPIC_ARN"
    },
    {
      "Effect": "Allow",
      "Action": "dynamodb:PutItem",
      "Resource": "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/orderflow-events"
    }
  ]
}
```

## Manifests

### Example DynamoDB item shape

```json
{
  "eventId": "evt-ord-002-20260609",
  "orderId": "ord-002",
  "status": "PROCESSED",
  "processedAt": "2026-06-09T12:00:00Z"
}
```

### Example SNS message

```json
{
  "order_id": "ord-002",
  "status": "PROCESSED",
  "message": "Order fulfillment complete"
}
```

## Verification

```bash
aws dynamodb describe-table --table-name orderflow-events \
  --query 'Table.{Name:TableName,Status:TableStatus,Billing:BillingModeSummary.BillingMode}'

aws sns get-topic-attributes --topic-arn $TOPIC_ARN
```

After Phase 13 worker runs, confirm items appear:

```bash
aws dynamodb scan --table-name orderflow-events --max-items 5
```

## Troubleshooting

### PutItem AccessDenied

Worker role missing `dynamodb:PutItem` on the table ARN (not `*`).

### SNS publish succeeds but no email

Confirm subscription status is **Confirmed** in the SNS console.

## Lessons learned

- Use **on-demand** billing for lab/event tables with unpredictable volume.
- Generate **unique eventId** per processing attempt for idempotent audit trails.

---
← [Previous: SQS Queue Integration]({{< relref "11-sqs-integration" >}})  [Next: Worker Deployment]({{< relref "13-worker-deployment" >}}) →
