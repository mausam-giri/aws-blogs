---
title: "Worker Deployment"
description: "OrderFlow walkthrough — SQS consumer, SNS publish, DynamoDB write."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - sqs
  - worker
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 130
related:
  - guides/orderflow-aws
  - examples/orderflow-snippets
---

## Objective

Deploy **orderflow-worker** with **OrderFlowWorkerRole** (IRSA) to poll SQS, publish SNS notifications, write DynamoDB events, and delete messages on success.

## Architecture

```
orderflow-orders (SQS)
  → orderflow-worker Deployment
      1. ReceiveMessage (long poll)
      2. Publish → orderflow-notifications
      3. PutItem → orderflow-events
      4. DeleteMessage
```

## Commands

### Create worker IAM policy and IRSA

```bash
aws iam create-policy \
  --policy-name OrderFlowWorkerPolicy \
  --policy-document file://orderflow-worker-policy.json

eksctl create iamserviceaccount \
  --cluster orderflow-cluster \
  --namespace orderflow \
  --name orderflow-worker \
  --role-name OrderFlowWorkerRole \
  --attach-policy-arn arn:aws:iam::ACCOUNT_ID:policy/OrderFlowWorkerPolicy \
  --approve
```

### Deploy worker

```bash
kubectl apply -f k8s/worker-deployment.yaml
kubectl rollout status deployment/orderflow-worker -n orderflow
kubectl logs -f deployment/orderflow-worker -n orderflow
```

### End-to-end test

```bash
curl -s -X POST "http://${ALB}/orders" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"ord-e2e-001","status":"CREATED"}'

aws sqs get-queue-attributes --queue-url $QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages

aws dynamodb scan --table-name orderflow-events \
  --filter-expression "orderId = :oid" \
  --expression-attribute-values '{":oid":{"S":"ord-e2e-001"}}'
```

## Manifests

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orderflow-worker
  namespace: orderflow
spec:
  replicas: 1
  selector:
    matchLabels:
      app: orderflow-worker
  template:
    metadata:
      labels:
        app: orderflow-worker
    spec:
      serviceAccountName: orderflow-worker
      containers:
        - name: worker
          image: ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orderflow/worker:v1
          env:
            - name: SQS_QUEUE_URL
              value: "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/orderflow-orders"
            - name: SNS_TOPIC_ARN
              value: "arn:aws:sns:us-east-1:ACCOUNT_ID:orderflow-notifications"
            - name: DYNAMODB_TABLE
              value: "orderflow-events"
            - name: AWS_REGION
              value: "us-east-1"
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
```

### Worker loop (Python sketch)

```python
import boto3, json, uuid, os, time

sqs = boto3.client("sqs")
sns = boto3.client("sns")
ddb = boto3.client("dynamodb")

while True:
    resp = sqs.receive_message(
        QueueUrl=os.environ["SQS_QUEUE_URL"],
        MaxNumberOfMessages=1,
        WaitTimeSeconds=20,
    )
    for msg in resp.get("Messages", []):
        body = json.loads(msg["Body"])
        order_id = body["order_id"]
        event_id = f"evt-{order_id}-{uuid.uuid4().hex[:8]}"

        sns.publish(
            TopicArn=os.environ["SNS_TOPIC_ARN"],
            Message=json.dumps({"order_id": order_id, "status": "PROCESSED"}),
        )
        ddb.put_item(
            TableName=os.environ["DYNAMODB_TABLE"],
            Item={
                "eventId": {"S": event_id},
                "orderId": {"S": order_id},
                "status": {"S": "PROCESSED"},
            },
        )
        sqs.delete_message(
            QueueUrl=os.environ["SQS_QUEUE_URL"],
            ReceiptHandle=msg["ReceiptHandle"],
        )
```

## Verification

| Step | Expected |
|------|----------|
| POST /orders | HTTP 201 |
| SQS depth | Returns to 0 after worker processes |
| DynamoDB | Item with matching `orderId` |
| Worker logs | `Processed ord-e2e-001` or equivalent |

## Troubleshooting

### Messages reappear after processing

DeleteMessage failing — check `sqs:DeleteMessage` on the queue ARN. Visibility timeout may be too short if processing exceeds 60s.

### Worker idle, queue depth grows

- Wrong queue URL in Deployment env.
- IRSA role not attached to `orderflow-worker` service account.
- Worker image crash — `kubectl logs` for stack traces.

## Lessons learned

- **Delete messages only after** SNS and DynamoDB succeed — or use a DLQ for poison messages.
- Scale workers on **ApproximateNumberOfMessages** (HPA custom metrics or KEDA in production).

---
← [Previous: SNS and DynamoDB]({{< relref "12-sns-dynamodb" >}})  [Next: CloudWatch Observability]({{< relref "14-cloudwatch-observability" >}}) →
