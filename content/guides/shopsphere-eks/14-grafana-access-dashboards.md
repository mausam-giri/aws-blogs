---
title: "Grafana Access and Dashboards"
description: "ShopSphere EKS walkthrough — Grafana Access and Dashboards."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - grafana
  - observability
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 140
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Expose Grafana to the internet via the AWS Load Balancer and import custom dashboards for the ShopSphere application.

## Architecture

```
Internet → ALB → /grafana path → monitoring namespace → Grafana Service
```

## Commands

### Create Grafana Ingress

```bash
kubectl apply -f monitoring/grafana-ingress.yaml
```

### Import Dashboards

1. Log into Grafana via the ALB URL.
2. Go to **Dashboards → Import**.
3. Import ID `3119` (Kubernetes Cluster Monitoring) or `13332` (Flask/Python metrics).

## Manifests

### Grafana Ingress

*Note: Ingress resources can ONLY reference services within the SAME namespace. Therefore, this must be created in the `monitoring` namespace.*

```yaml
# monitoring/grafana-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana-ingress
  namespace: monitoring # MUST be in the monitoring namespace
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}]'
    alb.ingress.kubernetes.io/group.name: shopsphere # Groups with main ALB
    alb.ingress.kubernetes.io/group.order: '10'
    alb.ingress.kubernetes.io/rewrite-target: /$2 # Strips /grafana prefix
spec:
  rules:
  - http:
      paths:
      - path: /grafana(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: monitoring-grafana
            port:
              number: 80
```

### Grafana Helm Values (Root URL fix)

If accessing via a subpath (`/grafana`), Grafana needs to know its root URL to load CSS/JS correctly.

```yaml
# grafana-values.yaml
grafana:
  grafana.ini:
    server:
      root_url: http://<ALB-DNS>/grafana
      serve_from_sub_path: true
```

*Upgrade helm:* `helm upgrade monitoring prometheus-community/kube-prometheus-stack -n monitoring -f grafana-values.yaml`

## Verification

```bash
# Verify Ingress is attached to the ALB
kubectl get ingress -n monitoring

# Test access
curl -I http://<ALB-DNS>/grafana
# Expected: HTTP/1.1 200 OK (or 302 redirect to login)
```

## Screenshots

> 

## Troubleshooting

### Issue: Cross Namespace Service Error

**Error:** `services "monitoring-grafana" not found` when creating Ingress in the `shopsphere` namespace.
**Reason:** Kubernetes Ingress controllers strictly enforce namespace boundaries for backend services.
**Fix:** Create a dedicated Ingress resource in the `monitoring` namespace and use the `alb.ingress.kubernetes.io/group.name` annotation to merge it into the existing ALB.

### Issue: Grafana UI is broken (missing CSS/JS)

**Cause:** Grafana is trying to load assets from the root path `/`, but it's being served under `/grafana`.
**Fix:** Configure `root_url` and `serve_from_sub_path` in the Grafana Helm values (see YAML snippet above).

## Lessons learned

✅ **Ingress is namespace-scoped.** You cannot route traffic to a service in another namespace directly from an Ingress. Use Ingress grouping (`group.name`) to merge multiple Ingress resources into a single ALB.

✅ **Sub-path routing requires app configuration.** When exposing an app on a subpath (like `/grafana`), the app itself must be configured to serve assets from that path.

---

## Project summary & Key Learnings

## 🧠 Kubernetes Mastery

- **Core Primitives:** Deployments, Services, ConfigMaps, Secrets, PVCs.
- **Networking:** ClusterIP vs NodePort vs LoadBalancer, Ingress path-based routing, DNS resolution between pods.
- **Storage:** Dynamic provisioning with StorageClasses and EBS CSI Driver.
- **Scaling:** HPA mechanics, the absolute requirement of `requests` for autoscaling.

## ☁️ AWS Integration

- **VPC Design:** Public vs Private subnets, NAT Gateways for private node internet access.
- **IAM & Security:** IRSA (IAM Roles for Service Accounts) to grant pod-level AWS permissions without node-level keys.
- **Load Balancing:** AWS Load Balancer Controller, ALB target types (IP vs Instance), Subnet tagging requirements.

## 📊 Observability

- **Metrics Server:** The bridge between Kubelet and HPA.
- **Prometheus/Grafana:** Scrape configs, ServiceMonitors, and visualizing cluster health.

## Troubleshooting notes

1. **Subnet Tags:** The ALB controller will silently fail to create load balancers if subnets aren't tagged with `kubernetes.io/role/elb`.
2. **Resource Requests:** HPA will completely ignore your pods if `resources.requests.cpu` is missing.
3. **Namespace Boundaries:** Ingress cannot cross namespaces.
4. **Node Capacity:** Monitoring stacks (Prometheus) will easily OOM or fail to schedule on `t3.small` instances.

---


---
← [Previous: Prometheus and Grafana]({{< relref "13-prometheus-grafana" >}})  [Next: Application Metrics]({{< relref "15-application-metrics" >}}) →
