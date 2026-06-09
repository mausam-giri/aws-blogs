---
title: "Frontend Application"
description: "ShopSphere EKS walkthrough — Frontend Application."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - nginx
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 100
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Deploy an Nginx-based frontend that serves static HTML/JS files and acts as a reverse proxy to route `/api/*` requests to the Flask backend service.

## Architecture

```
Browser
  ↓
Nginx (Frontend Pod)
  ├── / → Serves static files (index.html, CSS, JS)
  └── /api/* → Proxies to <http://backend:5000>
```

## Commands

### Build and Push Frontend Image

```bash
# Build the Docker image
docker build -t shopsphere-frontend:latest ./frontend

# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag shopsphere-frontend:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/shopsphere-frontend:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/shopsphere-frontend:latest
```

### Deploy to EKS

```bash
# Apply ConfigMap, Deployment, and Service
kubectl apply -f frontend/configmap.yaml
kubectl apply -f frontend/deployment.yaml
kubectl apply -f frontend/service.yaml

# Verify
kubectl get pods -n shopsphere -l app=frontend
```

## Manifests

### Nginx Configuration (ConfigMap)

```yaml
# frontend/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
  namespace: shopsphere
data:
  default.conf: |
    server {
        listen 80;
        server_name localhost;

        # Serve static frontend files
        location / {
            root   /usr/share/nginx/html;
            index  index.html index.htm;
            try_files $uri $uri/ /index.html; # For SPA routing
        }

        # Reverse proxy to backend API
        location /api/ {
            proxy_pass <http://backend:5000>;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
```

### Frontend Deployment

```yaml
# frontend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: shopsphere
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
        image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/shopsphere-frontend:latest
        ports:
        - containerPort: 80
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/conf.d/default.conf
          subPath: default.conf
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "200m"
      volumes:
      - name: nginx-config
        configMap:
          name: nginx-config
```

## Verification

```bash
# Test frontend through the ALB
curl http://<ALB-DNS>/
# Expected: HTML content of your frontend

# Test API proxy through frontend
curl http://<ALB-DNS>/api/products
# Expected: JSON array of products from the database
```

## Screenshots

> 

## Troubleshooting

### Issue: 502 Bad Gateway on `/api/*`

**Cause:** Nginx cannot resolve or connect to the `backend` service.
**Fix:** Ensure the backend service is named exactly `backend` and is in the same namespace. Check Nginx logs:

```bash
kubectl logs -n shopsphere deployment/frontend
# Look for: "host not found in upstream "backend:5000""
```

### Issue: CORS Errors in Browser Console

**Cause:** The browser blocks requests from the frontend domain to the backend.
**Fix:** Since Nginx is proxying the requests, the browser only sees one origin (the ALB). If you are calling the backend directly from JS instead of using relative URLs (`/api/...`), enable CORS in Flask:

```python
from flask_cors import CORS
CORS(app)
```

## Lessons learned

✅ **Use relative URLs in frontend code** (`/api/products` instead of `http://backend:5000/api/products`) so the browser routes through the ALB/Nginx proxy.

✅ **Nginx `try_files` is essential** for Single Page Applications (React/Vue/Angular) to handle client-side routing.

✅ **Mounting Nginx config via ConfigMap** allows you to update routing rules without rebuilding the Docker image.

---


---
← [Previous: Ingress Configuration]({{< relref "09-ingress-configuration" >}})  [Next: Metrics Server]({{< relref "11-metrics-server" >}}) →
