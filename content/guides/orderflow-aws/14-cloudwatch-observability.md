---
title: "CloudWatch Observability"
description: "OrderFlow walkthrough — Container Insights, logs, and operational metrics."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - cloudwatch
  - observability
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 140
related:
  - guides/orderflow-aws
  - guides/data-on-aws
---

## Objective

Install the **Amazon CloudWatch Observability** EKS add-on for container logs, Container Insights metrics, and a baseline for debugging API and worker issues.

## Architecture

```
orderflow-api / orderflow-worker pods
  → CloudWatch agent (DaemonSet)
  → Log groups /metrics in CloudWatch
  → Container Insights dashboards
```

## Commands

### Install add-on

```bash
aws eks create-addon \
  --cluster-name orderflow-cluster \
  --addon-name amazon-cloudwatch-observability \
  --resolve-conflicts OVERWRITE

kubectl get pods -n amazon-cloudwatch
```

### Tail API logs

```bash
aws logs tail /aws/containerinsights/orderflow-cluster/application \
  --follow --filter-pattern "orderflow-api"
```

### Useful kubectl checks

```bash
kubectl top pods -n orderflow
kubectl logs deployment/orderflow-api -n orderflow --since=1h
kubectl logs deployment/orderflow-worker -n orderflow --since=1h
```

## Manifests

No custom manifests required for the managed add-on. Optional: structured JSON logging in the app for easier CloudWatch Logs Insights queries:

```python
import json, logging
logging.basicConfig(format="%(message)s", level=logging.INFO)
logger = logging.getLogger("orderflow")
logger.info(json.dumps({"event": "order_created", "order_id": order_id}))
```

## Verification

```bash
kubectl get pods -n amazon-cloudwatch
# Expected: fluent-bit / cloudwatch-agent pods Running on each node

aws logs describe-log-groups \
  --log-group-name-prefix /aws/containerinsights/orderflow-cluster
```

## Troubleshooting

### No logs in CloudWatch

- Add-on pods not Running on all nodes.
- IAM permissions for the add-on service account missing (check EKS add-on status).
- Wrong log group region — match cluster Region.

### High log volume cost

Set retention on log groups and filter noisy health-check lines at the app or collector level.

## Lessons learned

- Correlate **API POST timestamps** with **worker processing logs** and **SQS ApproximateAgeOfOldestMessage** during incidents.
- Pair Container Insights with [RDS Performance Insights]({{< relref "guides/data-on-aws" >}}) when DB latency spikes.

---
← [Previous: Worker Deployment]({{< relref "13-worker-deployment" >}})  [Next: Roadmap]({{< relref "15-roadmap" >}}) →
