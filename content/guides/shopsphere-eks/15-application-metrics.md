---
title: "Application Metrics"
description: "ShopSphere EKS walkthrough — Application Metrics."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - prometheus
  - observability
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 150
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Expose custom application metrics from the Flask backend and configure Prometheus to scrape them using a `ServiceMonitor`, enabling deep observability into application-level performance (e.g., request counts, latency, database query times).

## Architecture

```
Flask App (prometheus_flask_instrumentator)
  ↓ (exposes /metrics endpoint)
Kubernetes Service (backend)
  ↓ (discovered by Prometheus Operator)
ServiceMonitor (Custom Resource)
  ↓ (tells Prometheus how to scrape)
Prometheus Server
  ↓ (stores time-series data)
Grafana Dashboards
```

## Commands

### Update Python Dependencies

Add the metrics library to your backend requirements.

```bash
echo "prometheus-flask-instrumentator==6.1.0" >> backend/requirements.txt
```

### Update Flask Application

Add the instrumentation code to `app.py`.

```python
# backend/app.py (Add to imports and initialization)
from prometheus_flask_instrumentator import Instrumentator

# ... after app = Flask(__name__) ...
Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

### Deploy and Create ServiceMonitor

```bash
# Rebuild and push the updated backend image
docker build -t shopsphere-backend:v2 ./backend
docker push <ECR-REPO-URI>/shopsphere-backend:v2

# Update the deployment image
kubectl set image deployment/backend backend=<ECR-REPO-URI>/shopsphere-backend:v2 -n shopsphere

# Apply the ServiceMonitor
kubectl apply -f monitoring/service-monitor.yaml
```

## Manifests

### Prometheus ServiceMonitor

*Crucial: The `labels` must match the `serviceMonitorSelector` configured in your `kube-prometheus-stack` Helm release (usually `release: monitoring`).*

```yaml
# monitoring/service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: backend-monitor
  namespace: shopsphere
  labels:
    release: monitoring # Must match Prometheus selector!
spec:
  selector:
    matchLabels:
      app: backend
  endpoints:
  - port: http
    path: /metrics
    interval: 15s
```

## Verification

```bash
# 1. Verify the /metrics endpoint is working
kubectl port-forward -n shopsphere svc/backend 5000:5000
curl <http://localhost:5000/metrics>
# Expected: Prometheus text format metrics (e.g., http_requests_total)

# 2. Verify Prometheus is scraping the target
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
# Open <http://localhost:9090/targets>
# Look for "shopsphere/backend-monitor" with State: UP
```

## Screenshots

> 

## Troubleshooting

### Issue: Target shows "DOWN" in Prometheus

**Cause:** The `ServiceMonitor` labels don't match the Prometheus Operator's selector, or the port name in the ServiceMonitor (`http`) doesn't exactly match the port name in the Kubernetes Service.
**Fix:** Ensure your backend Service has `name: http` for port 5000, and the ServiceMonitor uses `port: http`.

## Lessons learned

✅ **ServiceMonitors are the Prometheus Operator way.** Don't manually edit the Prometheus ConfigMap; use `ServiceMonitor` CRDs for dynamic discovery.

✅ **Label matching is strict.** The `release: monitoring` label is the bridge between your app namespace and the monitoring stack.

---


---
← [Previous: Grafana Access and Dashboards]({{< relref "14-grafana-access-dashboards" >}})  [Next: Advanced Autoscaling with Karpenter]({{< relref "16-advanced-autoscaling-karpenter" >}}) →
