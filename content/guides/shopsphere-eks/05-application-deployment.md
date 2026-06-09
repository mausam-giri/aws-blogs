---
title: "Application Deployment"
description: "ShopSphere EKS walkthrough — Application Deployment."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - kubernetes
  - deployment
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 50
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Deploy the Flask backend API and Nginx frontend application with proper service discovery and inter-pod communication.

## Architecture

```
Frontend (Nginx)
├── Port 80
├── Serves static HTML/JS
└── Proxies API calls to backend

Backend (Flask)
├── Port 5000
├── REST API endpoints
│   ├── GET /api/products
│   ├── POST /api/products
│   └── GET /api/health
└── Connects to PostgreSQL

Services
├── frontend-service (ClusterIP)
└── backend-service (ClusterIP)
```

## Commands

```bash
# Create namespace if not exists
kubectl create namespace shopsphere

# Deploy backend
kubectl apply -f backend/deployment.yaml
kubectl apply -f backend/service.yaml

# Deploy frontend
kubectl apply -f frontend/deployment.yaml
kubectl apply -f frontend/service.yaml

# Verify all pods
kubectl get pods -n shopsphere

# Check services
kubectl get svc -n shopsphere
```

## Manifests

### Backend Deployment

```yaml
# backend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: shopsphere
  labels:
    app: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: public.ecr.aws/myrepo/shopsphere-backend:latest
        ports:
        - containerPort: 5000
          name: http
        env:
        - name: DATABASE_URL
          value: "postgresql://postgres:$(POSTGRES_PASSWORD)@postgres:5432/shopsphere_db"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: FLASK_ENV
          value: "production"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Backend Service

```yaml
# backend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: shopsphere
  labels:
    app: backend
spec:
  type: ClusterIP
  ports:
  - port: 5000
    targetPort: 5000
    protocol: TCP
    name: http
  selector:
    app: backend
```

### Frontend Deployment

```yaml
# frontend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: shopsphere
  labels:
    app: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: public.ecr.aws/myrepo/shopsphere-frontend:latest
        ports:
        - containerPort: 80
          name: http
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Frontend Service

```yaml
# frontend/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: shopsphere
  labels:
    app: frontend
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
  selector:
    app: frontend
```

## Verification

```bash
# Check all resources
kubectl get all -n shopsphere

# Expected output:
# NAME                           READY   STATUS    RESTARTS   AGE
# pod/backend-6d8f9b7c4-abc12    1/1     Running   0          5m
# pod/backend-6d8f9b7c4-def34    1/1     Running   0          5m
# pod/frontend-5c7d8e9f0-ghi56   1/1     Running   0          5m
# pod/frontend-5c7d8e9f0-jkl78   1/1     Running   0          5m
# pod/postgres-xxxxx             1/1     Running   0          10m
#
# NAME              TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
# service/backend   ClusterIP   10.100.50.100   <none>        5000/TCP   5m
# service/frontend  ClusterIP   10.100.60.110   <none>        80/TCP     5m
# service/postgres  ClusterIP   10.100.70.120   <none>        5432/TCP   10m

# Test backend API
kubectl run test --rm -it --image=curlimages/curl --namespace=shopsphere -- bash
curl <http://backend:5000/api/health>

# Expected:
# {"status": "healthy", "database": "connected"}

# Test from outside cluster (after ingress setup)
curl http://<alb-dns>/api/products
```

## Application architecture

```
┌─────────────────────────────────────────────────┐
│              Application Load Balancer           │
│              (internet-facing)                   │
└─────────────────┬───────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────▼────┐      ┌────▼────┐
    │         │      │         │
    │  /      │      │ /api/*  │
    │         │      │         │
    └────┬────┘      └────┬────┘
         │                 │
    ┌────▼────┐      ┌────▼────┐
    │ Frontend│      │ Backend │
    │  Nginx  │      │  Flask  │
    │  :80    │      │  :5000  │
    └─────────      └────────┘
                          │
                    ┌─────▼─────┐
                    │ PostgreSQL│
                    │   :5432   │
                    └───────────┘
```

## Troubleshooting

### Issue: Backend cannot connect to database

**Symptoms:**

```bash
kubectl logs -n shopsphere deployment/backend

# Error:
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError)
could not translate host name "postgres" to address: Name or service not known
```

**Root Causes:**

```
❌ PostgreSQL service not running
❌ Wrong service name in DATABASE_URL
❌ Network policy blocking traffic
```

**Fix:**

```bash
# Verify PostgreSQL is running
kubectl get pods -n shopsphere -l app=postgresql

# Test DNS resolution
kubectl run dns-test --rm -it --image=busybox --namespace=shopsphere -- nslookup postgres

# Check service exists
kubectl get svc -n shopsphere postgres
```

### Issue: Frontend returns 502 Bad Gateway

**Symptoms:**

```bash
curl <http://frontend/api/products>
# 502 Bad Gateway
```

**Root Cause:**

```
❌ Backend service not found
❌ Wrong proxy configuration in Nginx
```

**Fix:**

```yaml
# Ensure Nginx config has correct upstream
# nginx.conf:
location /api/ {
    proxy_pass <http://backend:5000>;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```



```bash
# Check pod logs
kubectl logs -n shopsphere deployment/backend --tail=50
kubectl logs -n shopsphere deployment/frontend --tail=50

# Describe pods for events
kubectl describe pod -n shopsphere -l app=backend

# Test connectivity between pods
kubectl exec -it -n shopsphere deployment/frontend -- bash
curl -v <http://backend:5000/api/health>

# Check resource usage
kubectl top pods -n shopsphere

# Verify environment variables
kubectl exec -it -n shopsphere deployment/backend -- env | grep DATABASE
```

---


---
← [Previous: PostgreSQL Persistence]({{< relref "04-postgresql-persistence" >}})  [Next: ConfigMaps and Secrets]({{< relref "06-configmaps-secrets" >}}) →
## Lessons learned

- Document the exact commands and manifests you applied — rollback depends on knowing what changed.
- Verify each layer (network, storage, workload) before moving to the next phase.
- Keep IAM and secrets out of git; use Kubernetes Secrets or AWS Secrets Manager.
