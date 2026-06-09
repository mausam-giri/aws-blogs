---
title: "API Deployment"
description: "OrderFlow walkthrough — orderflow namespace, Flask API Deployment and Service."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - eks
  - deployment
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 60
related:
  - guides/orderflow-aws
  - examples/shopsphere-backend-app
---

## Objective

Deploy the **orderflow-api** Flask/Gunicorn application into the **orderflow** namespace with a **ClusterIP** Service. Database and secrets wiring come in Phases 09–10.

## Architecture

```
orderflow namespace
├── Deployment: orderflow-api (replicas: 2)
├── Service: orderflow-api-service (ClusterIP :5000)
└── ConfigMap: orderflow-api-config (non-secret env, Phase 10)
```

## Commands

```bash
kubectl create namespace orderflow

kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/api-service.yaml

kubectl rollout status deployment/orderflow-api -n orderflow
kubectl get pods,svc -n orderflow
```

## Manifests

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orderflow-api
  namespace: orderflow
  labels:
    app: orderflow-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orderflow-api
  template:
    metadata:
      labels:
        app: orderflow-api
    spec:
      serviceAccountName: orderflow-api
      containers:
        - name: api
          image: ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orderflow/api:v1
          ports:
            - containerPort: 5000
          envFrom:
            - configMapRef:
                name: orderflow-api-config
          readinessProbe:
            httpGet:
              path: /health
              port: 5000
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 5000
            initialDelaySeconds: 30
            periodSeconds: 20
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: orderflow-api-service
  namespace: orderflow
spec:
  type: ClusterIP
  selector:
    app: orderflow-api
  ports:
    - port: 80
      targetPort: 5000
      protocol: TCP
```

> **Note:** `serviceAccountName: orderflow-api` requires the IRSA service account from Phase 09. For initial image-only testing, use `default` temporarily, then switch after IRSA is created.

## Verification

```bash
kubectl port-forward svc/orderflow-api-service 8080:80 -n orderflow
curl -s http://localhost:8080/health
# Expected: {"status":"ok"} or HTTP 200
```

## Troubleshooting

### CrashLoopBackOff before RDS is configured

Expected until Phases 08–10 complete. Check logs:

```bash
kubectl logs deployment/orderflow-api -n orderflow --tail=50
```

If the app requires `DB_HOST` at startup, add placeholder ConfigMap values or defer readiness until RDS is reachable.

## Lessons learned

- Use **readiness** probes on `/health` so ALB target groups only receive ready pods.
- Keep the Service as **ClusterIP** — external access is via Ingress only.

---
← [Previous: AWS Load Balancer Controller]({{< relref "05-aws-load-balancer-controller" >}})  [Next: Ingress Configuration]({{< relref "07-ingress-configuration" >}}) →
