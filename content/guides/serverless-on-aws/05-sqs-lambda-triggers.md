---
title: "SQS and Lambda Triggers"
description: "Serverless walkthrough — event source mapping, batching, partial failures."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - sqs
  - lambda
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 50
related:
  - guides/serverless-on-aws
  - examples/lambda-event-pipeline
---

## Objective

Connect **OrderQueue** to a **worker Lambda** via an event source mapping with tuned batch size, visibility timeout, and DLQ handling.

## Architecture

```
SQS OrderQueue
  → event source mapping (batch up to 10)
  → WorkerFunction
  → DynamoDB PutItem (Phase 06)
  → DeleteMessage on success
```

## Commands

```bash
sam build
sam local invoke WorkerFunction --event events/sqs-order.json
```

### Sample SQS event (`events/sqs-order.json`)

```json
{
  "Records": [{
    "body": "{\"Message\":\"{\\\"orderId\\\":\\\"ord-1\\\",\\\"userId\\\":\\\"u1\\\",\\\"amount\\\":99,\\\"status\\\":\\\"CREATED\\\"}\"}"
  }]
}
```

## Manifests

```yaml
WorkerFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: app.lambda_handler
    CodeUri: src/worker/
    Policies:
      - SQSPollerPolicy:
          QueueName: !GetAtt OrderQueue.QueueName
      - DynamoDBCrudPolicy:
          TableName: !Ref OrdersTable
    Events:
      OrderQueueEvent:
        Type: SQS
        Properties:
          Queue: !GetAtt OrderQueue.Arn
          BatchSize: 10
          MaximumBatchingWindowInSeconds: 5
          FunctionResponseTypes:
            - ReportBatchItemFailures
```

### Worker handler pattern

```python
import json
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("OrdersTable")

def lambda_handler(event, context):
    failures = []
    for record in event["Records"]:
        try:
            body = json.loads(record["body"])
            # EventBridge → SQS wraps in SNS-style Message when using rule target
            detail = json.loads(body.get("Message", body))
            table.put_item(Item={
                "orderId": detail["orderId"],
                "userId": detail["userId"],
                "amount": detail["amount"],
                "status": detail["status"],
            })
        except Exception:
            failures.append({"itemIdentifier": record["messageId"]})
    return {"batchItemFailures": failures}
```

## Verification

```bash
aws lambda list-event-source-mappings --function-name WorkerFunction
# Expected: State Enabled, EventSourceArn = OrderQueue

aws dynamodb scan --table-name OrdersTable --max-items 3
```

## Troubleshooting

### Messages return to queue repeatedly

- **Visibility timeout** on the queue must exceed Lambda **timeout** (e.g. queue 60s, Lambda 30s).
- Unhandled exceptions without `ReportBatchItemFailures` retry the whole batch.

### Partial batch failures

Enable `FunctionResponseTypes: ReportBatchItemFailures` and return failed `messageId` values only.

## Lessons learned

- Tune **BatchSize** and **MaximumBatchingWindowInSeconds** for throughput vs latency.
- Monitor **DLQ depth** — non-zero means poison messages need inspection.

---
← [Previous: EventBridge]({{< relref "04-eventbridge" >}})  [Next: DynamoDB]({{< relref "06-dynamodb" >}}) →
