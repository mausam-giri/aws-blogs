---
title: "Metrics Server"
description: "ShopSphere EKS walkthrough — Metrics Server."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - metrics-server
  - observability
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 110
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Install the Kubernetes Metrics Server to collect CPU and memory metrics from pods and nodes. This is a strict prerequisite for Horizontal Pod Autoscaling (HPA).

## Architecture

```
Kubelet (on each node)
  ↓ (exposes /metrics/resource)
Metrics Server (Aggregation Layer)
  ↓ (exposes metrics.k8s.io API)
kubectl top / HPA Controller
```

## Commands

### Install Metrics Server

*Note: EKS does not install this by default.*

```bash
kubectl apply -f <https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml>
```

### Verify Installation

```bash
# Wait ~30 seconds for it to collect initial data
kubectl get pods -n kube-system | grep metrics-server

# Test node metrics
kubectl top nodes

# Test pod metrics
kubectl top pods -n shopsphere
```

## Verification

**Expected Output:**

```
NAME                         CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
ip-10-0-1-100.ec2.internal   150m         7%     1024Mi          26%
ip-10-0-2-100.ec2.internal   120m         6%     950Mi           24%
```

## Troubleshooting

### Issue: `kubectl top` returns `<unknown>`

**Cause:** The Metrics Server hasn't collected data yet, or the API service is not registering.
**Fix:**

```bash
# Check if metrics-server is crashing
kubectl logs -n kube-system deployment/metrics-server

# If you see TLS certificate errors (common in some local clusters, less in EKS),
# you may need to add the --kubelet-insecure-tls flag to the deployment args.
```

## Lessons learned

✅ **Metrics Server is NOT installed by default on EKS.** You must add it manually if you want to use HPA or `kubectl top`.

✅ **It takes 1-2 minutes** after deployment before metrics start populating. Don't panic if it shows `<unknown>` immediately.

---


---
← [Previous: Frontend Application]({{< relref "10-frontend-application" >}})  [Next: Horizontal Pod Autoscaler]({{< relref "12-horizontal-pod-autoscaler" >}}) →
