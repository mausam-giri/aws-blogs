---
title: "Backend Database Integration"
description: "ShopSphere EKS walkthrough — Backend Database Integration."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - postgresql
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 70
related:
  - guides/shopsphere-eks
  - examples/shopsphere-backend-app
  - guides/kubernetes-on-aws
---

## Objective

Implement a Flask REST API that connects to PostgreSQL, performs CRUD operations on products, and includes proper error handling and health checks.

## Architecture

```
Flask Application
├── app.py (Main application)
├── models.py (SQLAlchemy models)
├── config.py (Configuration)
└── requirements.txt

Database Schema
└── products
    ├── id (Serial, Primary Key)
    ├── name (VARCHAR 100)
    ├── description (TEXT)
    ├── price (DECIMAL 10,2)
    ├── stock (INTEGER)
    └── created_at (TIMESTAMP)

API Endpoints
├── GET    /api/health      - Health check
├── GET    /api/products    - List all products
├── GET    /api/products/:id - Get product by ID
├── POST   /api/products    - Create product
├── PUT    /api/products/:id - Update product
└── DELETE /api/products/:id - Delete product
```

## Commands

### Build and Push Docker Image

```bash
# Build image
docker build -t shopsphere-backend:latest ./backend

# Tag for ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

docker tag shopsphere-backend:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/shopsphere-backend:latest

# Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/shopsphere-backend:latest
```

### Test API Locally

```bash
# Run PostgreSQL locally
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=shopsphere_db \
  -p 5432:5432 \
  postgres:15-alpine

# Run backend
cd backend
pip install -r requirements.txt
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shopsphere_db"
python app.py

# Test endpoints
curl <http://localhost:5000/api/health>
curl <http://localhost:5000/api/products>
curl -X POST <http://localhost:5000/api/products> \
  -H "Content-Type: application/json" \
  -d '{"name":"Laptop","price":999.99,"stock":10}'
```

## Manifests

Full application source (`app.py`, Dockerfile, requirements, init SQL): [ShopSphere Backend Application]({{< relref "examples/shopsphere-backend-app" >}}).

### Backend deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: shopsphere
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
          image: <account>.dkr.ecr.us-east-1.amazonaws.com/shopsphere-backend:latest
          ports:
            - containerPort: 5000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
```

## Verification

```bash
# Check backend logs
kubectl logs -n shopsphere deployment/backend --tail=50

# Expected output:
# * Serving Flask app 'app'
# * Running on <http://0.0.0.0:5000>
# 127.0.0.1 - - [07/Jun/2026 10:00:00] "GET /api/health HTTP/1.1" 200

# Test health endpoint
kubectl run test --rm -it --image=curlimages/curl --namespace=shopsphere -- \
  curl <http://backend:5000/api/health>

# Expected:
# {"database":"connected","status":"healthy","timestamp":"2026-06-07T10:00:00"}

# Test create product
kubectl run test --rm -it --image=curlimages/curl --namespace=shopsphere -- bash
curl -X POST <http://backend:5000/api/products> \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Product","price":99.99,"stock":5}'

# Expected:
# {"id":1,"name":"Test Product","description":"","price":99.99,"stock":5,"created_at":"..."}

# Test get products
curl <http://backend:5000/api/products>

# Expected:
# {"products":[{"id":1,"name":"Test Product",...}],"count":1}

# Connect to database directly
kubectl run postgres-client --rm -it --image=postgres:15-alpine --namespace=shopsphere -- \
  psql -h postgres -U postgres -d shopsphere_db -c "SELECT * FROM products;"
```


## Troubleshooting

### Issue: CrashLoopBackOff

**Symptoms:**

```bash
kubectl get pods -n shopsphere
NAME       READY   STATUS             RESTARTS   AGE
backend    0/1     CrashLoopBackOff   5          10m

kubectl logs -n shopsphere deployment/backend
sqlalchemy.exc.OperationalError: could not connect to server
```

**Root Causes:**

```
❌ Database not running
❌ Wrong DATABASE_URL
❌ Missing environment variables
❌ Python syntax errors
❌ Missing dependencies
```

**Fix:**

```bash
# Check environment variables
kubectl describe pod -n shopsphere deployment/backend | grep -A 10 Environment

# Verify database connectivity
kubectl exec -it -n shopsphere deployment/backend -- \
  python -c "import psycopg2; psycopg2.connect('postgresql://postgres:password@postgres:5432/db')"

# Check for Python errors
kubectl logs -n shopsphere deployment/backend --previous

# Test database connection
kubectl run test --rm -it --image=postgres:15-alpine --namespace=shopsphere -- \
  psql -h postgres -U postgres -d shopsphere_db -c "SELECT 1"
```

### Issue: ModuleNotFoundError

**Symptoms:**

```bash
kubectl logs -n shopsphere deployment/backend
ModuleNotFoundError: No module named 'flask'
```

**Root Cause:**

```
❌ requirements.txt not copied in Dockerfile
❌ pip install failed
```

**Fix:**

```docker
# Ensure Dockerfile has:
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
```



```bash
# Check database tables
kubectl exec -it -n shopsphere deployment/postgres -- \
  psql -U postgres -d shopsphere_db -c "\dt"

# Check database connection from backend
kubectl exec -it -n shopsphere deployment/backend -- \
  python -c "from app import db; print(db.engine.connect())"

# View database logs
kubectl logs -n shopsphere deployment/postgres --tail=50

# Check for migration issues
kubectl exec -it -n shopsphere deployment/backend -- \
  python -c "from app import db, Product; db.create_all(); print('Tables created')"

# Monitor API requests
kubectl logs -n shopsphere deployment/backend -f | grep "GET\|POST"
```

---


---
← [Previous: ConfigMaps and Secrets]({{< relref "06-configmaps-secrets" >}})  [Next: AWS Load Balancer Controller]({{< relref "08-aws-load-balancer-controller" >}}) →
## Lessons learned

- Document the exact commands and manifests you applied — rollback depends on knowing what changed.
- Verify each layer (network, storage, workload) before moving to the next phase.
- Keep IAM and secrets out of git; use Kubernetes Secrets or AWS Secrets Manager.
