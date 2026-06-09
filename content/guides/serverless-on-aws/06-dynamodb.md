---
title: "DynamoDB"
description: "Serverless walkthrough — OrdersTable design, on-demand billing, and read API."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - dynamodb
  - lambda
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 60
related:
  - guides/serverless-on-aws
  - examples/lambda-event-pipeline
---

## Objective

Create **OrdersTable** with `orderId` as partition key, wire the worker for writes, and add an optional **read Lambda** behind `GET /orders/{id}`.

## Architecture

```
WorkerFunction → PutItem (OrdersTable)
ReadFunction   → GetItem  (OrdersTable) ← GET /orders/{id}
```

## Commands

```bash
aws dynamodb describe-table --table-name OrdersTable
aws dynamodb get-item --table-name OrdersTable \
  --key '{"orderId":{"S":"ord-1"}}'
```

## Manifests

```yaml
OrdersTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: OrdersTable
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: orderId
        AttributeType: S
    KeySchema:
      - AttributeName: orderId
        KeyType: HASH
    SSESpecification:
      SSEEnabled: true

ReadFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: app.lambda_handler
    CodeUri: src/read/
    Policies:
      - DynamoDBReadPolicy:
          TableName: !Ref OrdersTable
    Events:
      GetOrder:
        Type: HttpApi
        Properties:
          ApiId: !Ref OrderHttpApi
          Path: /orders/{id}
          Method: GET
```

### Read handler

```python
import json
import boto3

table = boto3.resource("dynamodb").Table("OrdersTable")

def lambda_handler(event, context):
    order_id = event["pathParameters"]["id"]
    resp = table.get_item(Key={"orderId": order_id})
    item = resp.get("Item")
    if not item:
        return {"statusCode": 404, "body": json.dumps({"error": "not found"})}
    return {"statusCode": 200, "body": json.dumps(item, default=str)}
```

## Verification

| Step | Expected |
|------|----------|
| Worker processes message | Item in `OrdersTable` |
| `GET /orders/{id}` | 200 with order JSON |
| Unknown id | 404 |

## Troubleshooting

### `ValidationException` on put_item

Attribute names in `Item` must match table key schema (`orderId` String).

### Hot partition on single orderId pattern

For high-cardinality order IDs (UUIDs), single-table partition key is fine. Add GSI only when access patterns require queries by `userId` or `status`.

## Lessons learned

- Start with **on-demand** billing for labs and early production; switch to provisioned + auto scaling when traffic is predictable (Phase 09).
- Enable **SSE** at table creation — cheaper than retrofitting compliance requirements.

---
← [Previous: SQS and Lambda Triggers]({{< relref "05-sqs-lambda-triggers" >}})  [Next: SAM Build and Deploy]({{< relref "07-sam-build-deploy" >}}) →
