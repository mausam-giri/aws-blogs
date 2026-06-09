---
title: "Application Auto Scaling"
description: "Serverless walkthrough — ECS target tracking, DynamoDB, SQS backlog metrics."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - autoscaling
  - ecs
  - dynamodb
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 90
related:
  - guides/serverless-on-aws
  - examples/serverless-snippets
  - guides/orderflow-aws/11-sqs-integration
---

## Objective

Configure **Application Auto Scaling** for non-Lambda workloads in hybrid architectures: ECS services, DynamoDB provisioned capacity, and custom **SQS backlog per task** metrics.

## Architecture

```
CloudWatch metric (CPU, queue depth, RCU)
  → Application Auto Scaling policy
  → ECS DesiredCount / DynamoDB capacity
```

Lambda scales automatically — this phase covers services that sit alongside Lambda (e.g. OrderFlow ECS workers).

## Commands

### ECS target tracking

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/orderflow-cluster/orderflow-worker \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 --max-capacity 10

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/orderflow-cluster/orderflow-worker \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cpu-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://ecs-cpu-scaling.json
```

### DynamoDB table auto scaling (provisioned mode)

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace dynamodb \
  --resource-id table/OrdersTable \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --min-capacity 5 --max-capacity 100

aws application-autoscaling put-scaling-policy \
  --service-namespace dynamodb \
  --resource-id table/OrdersTable \
  --scalable-dimension dynamodb:table:ReadCapacityUnits \
  --policy-name read-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "DynamoDBReadCapacityUtilization"
    },
    "ScaleInCooldown": 60,
    "ScaleOutCooldown": 60
  }'
```

> For new projects, **on-demand** DynamoDB (Phase 06) avoids capacity planning; use this when cost optimization requires provisioned mode.

## Manifests

### ECS SQS backlog scaling (`ecs-sqs-scaling.json`)

Full file: [Serverless snippets]({{< relref "examples/serverless-snippets" >}}).

```json
{
  "TargetValue": 100.0,
  "CustomizedMetricSpecification": {
    "MetricName": "ApproximateNumberOfMessagesVisible",
    "Namespace": "AWS/SQS",
    "Dimensions": [{ "Name": "QueueName", "Value": "orderflow-orders" }],
    "Statistic": "Average"
  },
  "ScaleInCooldown": 120,
  "ScaleOutCooldown": 60
}
```

Divide queue depth by **running task count** in custom metrics for accurate per-worker scaling (CloudWatch metric math or embedded metric format).

## Verification

```bash
aws application-autoscaling describe-scalable-targets \
  --service-namespace ecs

aws application-autoscaling describe-scaling-policies \
  --service-namespace ecs \
  --resource-id service/orderflow-cluster/orderflow-worker
```

## Troubleshooting

### Policy never scales out

- **Register scalable target** before attaching policy.
- Metric dimensions must match the resource exactly (queue name, table name, cluster/service id).
- For SQS, scale on **backlog per consumer**, not raw depth, when task count changes.

### Oscillation (flapping)

Increase `ScaleInCooldown` / `ScaleOutCooldown`. Use target tracking for steady metrics; step scaling for sharp thresholds.

## Lessons learned

- **Target tracking** for CPU and utilization; **step scaling** for queue depth step changes.
- Lambda concurrency limits are separate from Application Auto Scaling — tune both in hybrid systems.

---
← [Previous: Versions and Concurrency]({{< relref "08-versions-concurrency" >}})  [Next: CI/CD with CodeDeploy]({{< relref "10-cicd-codedeploy" >}}) →
