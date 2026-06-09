---
title: "Horizontal Pod Autoscaler"
description: "ShopSphere EKS walkthrough — Horizontal Pod Autoscaler."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - hpa
  - autoscaling
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 120
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Configure the backend deployment to automatically scale from 1 to 5 replicas based on CPU utilization.

## Architecture

```
HPA Controller
  ↓ (queries every 15s)
Metrics Server
  ↓ (returns current CPU usage)
HPA calculates desired replicas
  ↓
Updates Deployment.replicas
```

## Commands

### Apply HPA and Load Generator

```bash
kubectl apply -f backend/hpa.yaml
kubectl apply -f utils/load-generator.yaml
```

### Watch Scaling in Real-Time

```bash
# Watch HPA metrics
kubectl get hpa -n shopsphere -w

# Watch pods being created
kubectl get pods -n shopsphere -w
```

## Manifests

### Horizontal Pod Autoscaler

```yaml
# backend/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: shopsphere
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50 # Target 50% CPU usage
```

### Load Generator Pod

```yaml
# utils/load-generator.yaml
apiVersion: v1
kind: Pod
metadata:
  name: load-generator
  namespace: shopsphere
spec:
  containers:
  - name: busybox
    image: busybox
    command: ["sh", "-c", "while true; do wget -q -O- <http://backend/api/products>; done"]
```

## Verification

```bash
# After a few minutes of load generation, you should see:
kubectl get hpa -n shopsphere
NAME          REFERENCE             TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
backend-hpa   Deployment/backend    75%/50%   1         5         3          5m
```

## Troubleshooting

### Issue: HPA shows `0%/50%` or `<unknown>` and never scales

**Cause:** The target deployment is missing CPU `requests` in its resource limits. HPA calculates utilization as a percentage of the *request*, not the *limit*.
**Fix:** Ensure your backend deployment has:

```yaml
resources:
  requests:
    cpu: "100m" # This is mandatory for HPA
```



```bash
# See exactly what the HPA is calculating
kubectl describe hpa backend-hpa -n shopsphere
```

## Lessons learned

✅ **HPA scales PODS, not NODES.** If your nodes run out of CPU/Memory to schedule the new pods, the new pods will stay in `Pending` state. (You need Cluster Autoscaler or Karpenter to scale nodes).

✅ **Resource requests are mandatory.** Without `requests.cpu`, the HPA math breaks.

---


---
← [Previous: Metrics Server]({{< relref "11-metrics-server" >}})  [Next: Prometheus and Grafana]({{< relref "13-prometheus-grafana" >}}) →
