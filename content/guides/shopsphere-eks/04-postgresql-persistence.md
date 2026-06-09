---
title: "PostgreSQL Persistence"
description: "ShopSphere EKS walkthrough — PostgreSQL Persistence."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - postgresql
  - ebs
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 40
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Deploy a production-ready PostgreSQL database with persistent storage, proper resource limits, and health checks.

## Architecture

```
PostgreSQL Deployment
├── 1 Replica (can scale to HA)
├── Resource Limits: 512Mi RAM, 500m CPU
└── Health Checks: liveness & readiness

PersistentVolumeClaim
├── 10Gi gp3 storage
├── ReadWriteOnce access
└── Retain policy

Service (ClusterIP)
└── Port 5432
```

## Commands

### Create Namespace

```bash
kubectl create namespace shopsphere
kubectl config set-context --current --namespace=shopsphere
```

### Deploy PostgreSQL

```bash
# Apply all resources
kubectl apply -f postgres/

# Or deploy individually
kubectl apply -f postgres/storageclass.yaml
kubectl apply -f postgres/pvc.yaml
kubectl apply -f postgres/deployment.yaml
kubectl apply -f postgres/service.yaml
kubectl apply -f postgres/configmap.yaml
kubectl apply -f postgres/secret.yaml
```

## Manifests

### PersistentVolumeClaim

```yaml
# postgres/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: shopsphere
  labels:
    app: postgresql
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: gp3
```

### PostgreSQL Deployment

```yaml
# postgres/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: shopsphere
  labels:
    app: postgresql
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: postgres-config
              key: database-name
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
          subPath: postgres
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - $(POSTGRES_USER)
            - -d
            - $(POSTGRES_DB)
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - $(POSTGRES_USER)
            - -d
            - $(POSTGRES_DB)
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
      securityContext:
        fsGroup: 999  # postgres user
```

### PostgreSQL Service

```yaml
# postgres/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: shopsphere
  labels:
    app: postgresql
spec:
  type: ClusterIP
  ports:
  - port: 5432
    targetPort: 5432
    protocol: TCP
    name: postgres
  selector:
    app: postgresql
```

### ConfigMap

```yaml
# postgres/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: shopsphere
data:
  database-name: "shopsphere_db"
  database-host: "postgres"
  database-port: "5432"
```

### Secret (Base64 encoded)

```yaml
# postgres/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: shopsphere
type: Opaque
data:
  username: cG9zdGdyZXM=  # postgres (base64)
  password: c2VjdXJlcGFzc3dvcmQxMjM=  # securepassword123 (base64)
```

**Generate base64:**

```bash
echo -n "postgres" | base64
echo -n "your-secure-password" | base64
```

## Verification

```bash
# Check PVC status
kubectl get pvc -n shopsphere
# Expected: STATUS = Bound

# Check pods
kubectl get pods -n shopsphere -l app=postgresql
# Expected: STATUS = Running

# Check logs
kubectl logs -n shopsphere deployment/postgres

# Test database connection
kubectl run postgres-client --rm --it --image=postgres:15-alpine --namespace=shopsphere -- bash

# Inside pod:
psql -h postgres -U postgres -d shopsphere_db

# Run query:
\dt
SELECT version();
```

**Expected Output:**

```
PostgreSQL 15.3 on x86_64-pc-linux-musl
(1 row)
```

## Screenshots

**EBS Volume for PostgreSQL:**

```
🔗 Console Path: EC2 → Volumes
✅ Volume ID: vol-0xxxx
✅ Size: 10 GiB
✅ Type: gp3
✅ State: In-use
✅ Attached to: <EKS node>
✅ Tags: kubernetes.io/created-for/pvc/name=postgres-pvc
```

## Troubleshooting

### Issue: PVC remains Pending

**Symptoms:**

```bash
kubectl describe pvc postgres-pvc
Events:
  Warning  ProvisioningFailed  failed to provision volume:
  rpc error: code = Internal desc = Could not attach volume
```

**Root Cause:**

```
❌ EBS CSI Driver not installed (See Phase 3)
```

**Fix:**

```bash
kubectl apply -k "github.com/kubernetes-sigs/aws-ebs-csi-driver/deploy/kubernetes/overlays/stable/"
```

### Issue: Pod CrashLoopBackOff

**Symptoms:**

```bash
kubectl get pods -n shopsphere
NAME         READY   STATUS             RESTARTS   AGE
postgres-0   0/1     CrashLoopBackOff   5          10m
```

**Root Causes:**

```
❌ Wrong permissions on data directory
❌ Invalid password encoding
❌ Insufficient memory
```

**Fix:**

```bash
# Check logs
kubectl logs -n shopsphere deployment/postgres

# Common fix: Ensure fsGroup is set
# Add to deployment spec:
securityContext:
  fsGroup: 999
```



```bash
# Describe pod for events
kubectl describe pod -n shopsphere -l app=postgresql

# Check persistent volume
kubectl get pv
kubectl describe pv <pv-name>

# Test database connectivity from backend pod
kubectl exec -it -n shopsphere <backend-pod> -- bash
nc -zv postgres 5432

# Check PostgreSQL logs
kubectl logs -n shopsphere deployment/postgres --tail=100
```

## Lessons learned

✅ **Always use persistent storage for databases**

✅ **Set resource limits** (prevent OOM kills)

✅ **Use liveness & readiness probes** (proper health checks)

✅ **Store passwords in Secrets** (not ConfigMaps)

✅ **Use fsGroup for proper permissions**

✅ **Set reclaimPolicy: Retain** (prevent data loss)

---


---
← [Previous: EBS CSI Driver]({{< relref "03-ebs-csi-driver" >}})  [Next: Application Deployment]({{< relref "05-application-deployment" >}}) →
