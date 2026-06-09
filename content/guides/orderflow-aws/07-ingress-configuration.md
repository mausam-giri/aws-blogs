---
title: "Ingress Configuration"
description: "OrderFlow walkthrough — orderflow-ingress and ALB path routing."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - alb
  - ingress
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 70
related:
  - guides/orderflow-aws
  - guides/shopsphere-eks/09-ingress-configuration
---

## Objective

Expose the API through **orderflow-ingress**, letting the AWS Load Balancer Controller provision an internet-facing ALB with health checks on `/health`.

## Architecture

```
Internet
  → ALB (internet-facing)
  → Target group (pod IPs, HTTP :5000)
  → orderflow-api-service
  → orderflow-api pods
```

## Commands

```bash
kubectl apply -f k8s/ingress.yaml

kubectl get ingress -n orderflow -w
# Wait until ADDRESS column shows ALB hostname

export ALB=$(kubectl get ingress orderflow-ingress -n orderflow \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
curl -s "http://${ALB}/health"
```

## Manifests

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: orderflow-ingress
  namespace: orderflow
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}]'
spec:
  ingressClassName: alb
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: orderflow-api-service
                port:
                  number: 80
```

When the frontend is deployed, add a second path rule for `/` static content and `/api/*` to the API — mirror [ShopSphere ingress]({{< relref "guides/shopsphere-eks/09-ingress-configuration" >}}).

## Verification

```bash
kubectl describe ingress orderflow-ingress -n orderflow
aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[?contains(LoadBalancerName, `k8s-orderflow`)].{Name:LoadBalancerName,DNS:DNSName,State:State.Code}'

curl -s -o /dev/null -w "%{http_code}" "http://${ALB}/health"
# Expected: 200
```

## Troubleshooting

### Ingress has no ADDRESS

1. Controller pods running? (Phase 05)
2. Subnet tags correct? (Phase 01)
3. Check events: `kubectl describe ingress orderflow-ingress -n orderflow`

### ALB targets unhealthy

Verify readiness probe on `/health` and security groups allow node → pod traffic on port 5000.

## Lessons learned

- Set **`target-type: ip`** for EKS — registers pod IPs directly.
- Align **healthcheck-path** with the app readiness endpoint.

---
← [Previous: API Deployment]({{< relref "06-api-deployment" >}})  [Next: RDS PostgreSQL]({{< relref "08-rds-postgresql" >}}) →
