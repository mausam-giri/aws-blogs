---
title: "Observability and Operations"
description: "Serverless walkthrough — CloudWatch logs, metrics, alarms, and production runbook."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - cloudwatch
  - lambda
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 110
related:
  - guides/serverless-on-aws
  - guides/data-on-aws
---

## Objective

Operate the serverless stack with structured logging, actionable alarms, X-Ray tracing, and a concise incident runbook.

## Architecture

```
Lambda (Tracing: Active)
  → X-Ray segments
  → CloudWatch Logs (/aws/lambda/*)
  → CloudWatch Metrics (Errors, Duration, Throttles, ConcurrentExecutions)
  → Alarms → SNS ops topic
```

## Commands

### Tail logs

```bash
aws logs tail /aws/lambda/order-serverless-ProducerFunction --follow
aws logs tail /aws/lambda/order-serverless-WorkerFunction --since 1h --filter-pattern ERROR
```

### Key metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=order-serverless-WorkerFunction \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 --statistics Sum
```

### SQS DLQ depth

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name ApproximateNumberOfMessagesVisible \
  --dimensions Name=QueueName,Value=order-events-dlq \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 3600 --statistics Maximum
```

## Manifests

### Error alarm (SAM)

```yaml
WorkerErrorAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: order-worker-errors
    MetricName: Errors
    Namespace: AWS/Lambda
    Statistic: Sum
    Period: 60
    EvaluationPeriods: 1
    Threshold: 1
    ComparisonOperator: GreaterThanOrEqualToThreshold
    Dimensions:
      - Name: FunctionName
        Value: !Ref WorkerFunction
    AlarmActions:
      - !Ref OpsTopic

OpsTopic:
  Type: AWS::SNS::Topic
  Properties:
    TopicName: order-serverless-ops
```

### Structured log line (Python)

```python
import json, logging
logger = logging.getLogger()
logger.info(json.dumps({"event": "order_processed", "orderId": order_id}))
```

## Verification

| Check | Tool |
|-------|------|
| API returns 201 | `curl POST /orders` |
| Worker errors | CloudWatch `Errors` metric |
| DLQ empty | SQS `ApproximateNumberOfMessages` on DLQ |
| Trace end-to-end | X-Ray service map |

## Troubleshooting runbook

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| API 502 | Lambda timeout or crash | Check function logs, increase timeout |
| Queue depth growing | Worker throttled or failing | Logs + DLQ; scale concurrency or fix bug |
| DynamoDB throttling | On-demand spike or hot key | Review access pattern; consider GSI |
| Canary rollback | Error alarm breached | CodeDeploy events; revert alias |

## Production checklist

- [ ] X-Ray tracing enabled on all functions
- [ ] Alarms on Errors, Duration p99, DLQ depth
- [ ] Log retention set (not indefinite)
- [ ] Least-privilege IAM per function
- [ ] `prod` alias + CodeDeploy canary for releases
- [ ] API CORS locked to known origins
- [ ] Secrets in Secrets Manager / SSM, not env plaintext

## Lessons learned

- Alert on **DLQ depth > 0** — it signals poison messages, not transient noise.
- Use **JSON logs** for Logs Insights queries across API and worker.
- Serverless debugging is log- and metric-driven — invest in alarms before launch.

---
← [Previous: CI/CD with CodeDeploy]({{< relref "10-cicd-codedeploy" >}})

**See also:** [Lambda event pipeline]({{< relref "examples/lambda-event-pipeline" >}}) · [OrderFlow]({{< relref "guides/orderflow-aws" >}}) (EKS equivalent)
