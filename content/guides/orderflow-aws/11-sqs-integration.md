---
title: "SQS Queue Integration"
description: "OrderFlow walkthrough — orderflow-orders queue and API enqueue after RDS insert."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - sqs
  - event-driven
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 110
related:
  - guides/orderflow-aws
  - examples/lambda-event-pipeline
---

## Objective

Create **orderflow-orders** (SQS) and extend the API so every successful `POST /orders` enqueues a message for asynchronous processing.

## Architecture

```
POST /orders
  → INSERT orders (RDS) — synchronous
  → SendMessage (SQS orderflow-orders) — synchronous
  → HTTP 201 to client
  → Worker consumes later (Phase 13)
```

## Commands

### Create queue

```bash
aws sqs create-queue \
  --queue-name orderflow-orders \
  --attributes '{
    "VisibilityTimeout": "60",
    "MessageRetentionPeriod": "345600",
    "ReceiveMessageWaitTimeSeconds": "20"
  }'

export QUEUE_URL=$(aws sqs get-queue-url \
  --queue-name orderflow-orders --query QueueUrl --output text)
```

### Grant API permission to send messages

Add to **OrderFlowApiSecretsPolicy** or a separate **OrderFlowApiSqsPolicy**:

```json
{
  "Effect": "Allow",
  "Action": ["sqs:SendMessage", "sqs:GetQueueUrl"],
  "Resource": "arn:aws:sqs:us-east-1:ACCOUNT_ID:orderflow-orders"
}
```

```bash
aws iam attach-role-policy \
  --role-name OrderFlowApiRole \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/OrderFlowApiSqsPolicy
```

### Test enqueue

```bash
curl -s -X POST "http://${ALB}/orders" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"ord-002","status":"CREATED"}'

aws sqs get-queue-attributes \
  --queue-url $QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages
```

## Manifests

### ConfigMap addition

```yaml
data:
  SQS_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/orderflow-orders"
```

### API enqueue snippet

```python
import boto3, json, os

sqs = boto3.client("sqs", region_name=os.environ["AWS_REGION"])

def enqueue_order(order_id: str, status: str):
    sqs.send_message(
        QueueUrl=os.environ["SQS_QUEUE_URL"],
        MessageBody=json.dumps({"order_id": order_id, "status": status}),
    )
```

Call `enqueue_order()` after successful DB commit in `create_order()`.

## Verification

```bash
aws sqs receive-message --queue-url $QUEUE_URL --max-number-of-messages 1
# Expected: body contains order_id from POST /orders
```

## Troubleshooting

### Message not appearing after POST

- API role missing `sqs:SendMessage`.
- Wrong `SQS_QUEUE_URL` in ConfigMap (region/account mismatch).
- API returns 201 but enqueue runs after failed commit — check transaction order in code.

### Duplicate messages on client retry

Use a deduplication id or idempotency key on `order_id` if clients may retry POST.

## Lessons learned

- Enqueue **after** DB commit — if SQS fails, return 500 so clients can retry safely.
- Set **visibility timeout** longer than worker processing time (Phase 13).

---
← [Previous: API and Database Integration]({{< relref "10-api-database-integration" >}})  [Next: SNS and DynamoDB]({{< relref "12-sns-dynamodb" >}}) →
