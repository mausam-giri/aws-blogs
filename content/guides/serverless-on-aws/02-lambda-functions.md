---
title: "Lambda Functions"
description: "Serverless walkthrough — producer handler, execution roles, and least-privilege IAM."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - lambda
  - iam
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 20
related:
  - guides/serverless-on-aws
  - examples/lambda-event-pipeline
  - examples/iam-policies
---

## Objective

Define the **producer Lambda** that accepts order payloads and publishes to EventBridge, with an execution role scoped to `events:PutEvents` only.

## Architecture

```
API Gateway event
  → ProducerFunction (Python 3.12)
  → events:PutEvents (default bus)
  → returns 200 + order JSON
```

## Commands

```bash
sam build
sam local invoke ProducerFunction --event events/create-order.json
```

### Sample event (`events/create-order.json`)

```json
{
  "body": "{\"userId\":\"user-101\",\"amount\":250}",
  "requestContext": { "http": { "method": "POST" } }
}
```

## Manifests

### SAM function resource

```yaml
ProducerFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: app.lambda_handler
    CodeUri: src/producer/
    Description: Publishes OrderCreated events
    Policies:
      - EventBridgePutEventsPolicy:
          EventBusName: default
```

### Handler (from [Lambda event pipeline]({{< relref "examples/lambda-event-pipeline" >}}))

```python
import json
import boto3
import uuid

eventbridge = boto3.client("events")

def lambda_handler(event, context):
    body = json.loads(event.get("body") or "{}")
    order = {
        "orderId": str(uuid.uuid4()),
        "userId": body.get("userId", "unknown"),
        "amount": body.get("amount", 0),
        "status": "CREATED",
    }
    eventbridge.put_events(
        Entries=[{
            "Source": "app.orders",
            "DetailType": "OrderCreated",
            "Detail": json.dumps(order),
            "EventBusName": "default",
        }]
    )
    return {"statusCode": 200, "body": json.dumps(order)}
```

## Verification

```bash
sam local invoke ProducerFunction --event events/create-order.json
# Expected: statusCode 200, body contains orderId

# After deploy (Phase 07):
aws logs tail /aws/lambda/order-serverless-ProducerFunction --since 5m
```

## Troubleshooting

### `AccessDeniedException` on PutEvents

SAM policy missing or wrong `EventBusName`. For custom buses, scope the policy to that bus ARN.

### Handler import errors locally

Run `sam build` before `sam local invoke` so dependencies are copied into `.aws-sam/build`.

## Lessons learned

- Prefer **SAM policy templates** (`EventBridgePutEventsPolicy`, `DynamoDBCrudPolicy`) over `AmazonDynamoDBFullAccess`.
- Return structured API Gateway responses (`statusCode`, `headers`, `body`) when behind HTTP API.

---
← [Previous: SAM Project Setup]({{< relref "01-sam-project-setup" >}})  [Next: HTTP API Gateway]({{< relref "03-http-api-gateway" >}}) →
