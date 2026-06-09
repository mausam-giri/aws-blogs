---
title: "SAM Build and Deploy"
description: "Serverless walkthrough — build, local test, guided and CI deploy."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - sam
  - deployment
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 70
related:
  - guides/serverless-on-aws
  - examples/serverless-snippets
---

## Objective

Build the SAM app, test locally, deploy to AWS with `sam deploy --guided`, and capture outputs (API URL, queue ARN, table name).

## Architecture

```
sam build → .aws-sam/build/
sam deploy → CloudFormation stack order-serverless
  → Lambda functions, HTTP API, SQS, DynamoDB, EventBridge rule
```

## Commands

### Build and test

```bash
sam build --use-container   # optional: match Lambda Linux env
sam local invoke ProducerFunction --event events/create-order.json
sam local start-api
```

### Guided first deploy

```bash
sam deploy --guided
# Stack name: order-serverless
# Region: us-east-1
# Confirm changesets: Y
# Allow IAM role creation: Y
# Save arguments to samconfig.toml: Y (if safe for repo)
```

### Subsequent deploys

```bash
sam build && sam deploy
```

### Stack outputs

```bash
aws cloudformation describe-stacks --stack-name order-serverless \
  --query 'Stacks[0].Outputs'
```

## Manifests

Add outputs to `template.yaml`:

```yaml
Outputs:
  ApiEndpoint:
    Description: HTTP API base URL
    Value: !Sub "https://${OrderHttpApi}.execute-api.${AWS::Region}.amazonaws.com"
  OrdersTableName:
    Value: !Ref OrdersTable
  OrderQueueUrl:
    Value: !Ref OrderQueue
```

## Verification

```bash
export API=$(aws cloudformation describe-stacks --stack-name order-serverless \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)

curl -s -X POST "$API/orders" -H "Content-Type: application/json" \
  -d '{"userId":"deploy-test","amount":42}'

aws dynamodb scan --table-name OrdersTable --max-items 1
```

## Troubleshooting

### Changeset failed: circular dependency

EventBridge rule + SQS policy sometimes need explicit `DependsOn`. Add `DependsOn: OrderCreatedRule` on the queue policy resource.

### Deployment bucket errors

Use `resolve_s3 = true` in `samconfig.toml` or pass `--resolve-s3` so SAM creates a managed artifacts bucket.

### `sam local` works, deployed Lambda fails

Missing env vars or IAM policies — compare `.aws-sam/build/template.yaml` synthesized policies with CloudWatch Logs.

## Lessons learned

- Run **`sam validate --lint`** before every deploy.
- Use **separate stacks or parameters** for dev/staging/prod — do not share DynamoDB tables across environments.

---
← [Previous: DynamoDB]({{< relref "06-dynamodb" >}})  [Next: Versions and Concurrency]({{< relref "08-versions-concurrency" >}}) →
