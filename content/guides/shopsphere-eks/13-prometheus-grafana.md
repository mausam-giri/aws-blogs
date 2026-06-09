---
title: "Prometheus and Grafana"
description: "ShopSphere EKS walkthrough — Prometheus and Grafana."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - prometheus
  - grafana
  - observability
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 130
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Deploy a production-grade observability stack using the `kube-prometheus-stack` Helm chart to monitor cluster health, node metrics, and application performance.

## Architecture

```
kube-prometheus-stack
├── Prometheus (Time-series DB)
├── Grafana (Visualization)
├── Alertmanager (Alert routing)
├── Node Exporter (DaemonSet for OS metrics)
└── kube-state-metrics (K8s object metrics)
```

## Commands

### Install via Helm

```bash
# Create namespace
kubectl create namespace monitoring

# Add repo and install
helm repo add prometheus-community <https://prometheus-community.github.io/helm-charts>
helm repo update

helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=gp3
```

### Access Grafana Temporarily

```bash
# Get auto-generated admin password
kubectl get secret --namespace monitoring monitoring-grafana \
  -o jsonpath="{.data.admin-password}" | base64 --decode ; echo

# Port-forward to access locally
kubectl port-forward --namespace monitoring svc/monitoring-grafana 3000:80
# Open <http://localhost:3000> (User: admin, Password: <from above>)
```

## Verification

```bash
# Check all pods are running
kubectl get pods -n monitoring

# Expected:
# monitoring-grafana-xxxxx               3/3     Running
# monitoring-kube-prometheus-operator    1/1     Running
# monitoring-prometheus-xxxxx            2/2     Running
# monitoring-node-exporter-xxxxx         1/1     Running
```

## Screenshots

> 

## Troubleshooting

### Issue: Helm Timeout / Pods stuck in Pending

**Error:** `context deadline exceeded` during `helm install`.
**Events:** `0/2 nodes are available: Too many pods` or `Insufficient memory`.
**Root Cause:** The monitoring stack is resource-heavy. Two `t3.small` nodes (2 vCPU, 2GB RAM) will quickly run out of capacity.
**Resolution:** Scale your EKS Node Group. Change instance type to `t3.medium` or increase the Desired capacity to 3 nodes.

### Issue: Prometheus PVC stuck in Pending

**Cause:** The chart requests persistent storage, but the StorageClass doesn't exist or the EBS CSI driver isn't working.
**Fix:** Ensure Phase 3 (EBS CSI Driver) was completed successfully.

## Lessons learned

✅ **Monitor the Monitors:** Prometheus can be memory-hungry. Always ensure your node group has sufficient RAM (recommend `t3.medium` or larger for the monitoring stack).

✅ **HPA vs Cluster Autoscaler:** Remember that HPA scales pods. If HPA creates pods that can't be scheduled because the cluster is full, you need a Node Autoscaler (like Cluster Autoscaler or Karpenter) to add more EC2 instances.

---


---
← [Previous: Horizontal Pod Autoscaler]({{< relref "12-horizontal-pod-autoscaler" >}})  [Next: Grafana Access and Dashboards]({{< relref "14-grafana-access-dashboards" >}}) →
