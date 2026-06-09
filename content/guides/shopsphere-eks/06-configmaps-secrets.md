---
title: "ConfigMaps and Secrets"
description: "ShopSphere EKS walkthrough — ConfigMaps and Secrets."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - kubernetes
  - secrets
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 60
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Externalize application configuration using ConfigMaps and securely manage sensitive data using Kubernetes Secrets.

## Architecture

```
ConfigMap (Non-sensitive)
├── database-name
├── database-host
├── database-port
├── app-settings
└── feature-flags

Secret (Sensitive - Base64 encoded)
├── username
├── password
├── api-keys
└── certificates

Injected into Pods as:
├── Environment Variables
└── Volume Mounts
```

## Commands

### Create ConfigMap

```bash
# From literal values
kubectl create configmap app-config \
  --from-literal=database-name=shopsphere_db \
  --from-literal=database-host=postgres \
  --from-literal=database-port=5432 \
  --from-literal=log-level=info \
  --namespace=shopsphere

# From file
kubectl create configmap nginx-config \
  --from-file=nginx.conf=./config/nginx.conf \
  --namespace=shopsphere

# From env file
kubectl create configmap app-env \
  --from-env-file=.env \
  --namespace=shopsphere
```

### Create Secret

```bash
# From literal values
kubectl create secret generic postgres-secret \
  --from-literal=username=postgres \
  --from-literal=password='SecureP@ssw0rd123!' \
  --namespace=shopsphere

# From file
kubectl create secret generic tls-secret \
  --from-file=tls.crt=./certs/tls.crt \
  --from-file=tls.key=./certs/tls.key \
  --type=kubernetes.io/tls \
  --namespace=shopsphere

# From env file
kubectl create secret generic app-secrets \
  --from-env-file=.env.secrets \
  --namespace=shopsphere
```

### View Secrets (Decoded)

```bash
# List secrets
kubectl get secrets -n shopsphere

# Get secret value (base64 encoded)
kubectl get secret postgres-secret -n shopsphere -o jsonpath='{.data.password}'

# Decode secret
kubectl get secret postgres-secret -n shopsphere -o jsonpath='{.data.password}' | base64 --decode

# Edit secret
kubectl edit secret postgres-secret -n shopsphere
```

## Manifests

### Complete ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: shopsphere
data:
  # Database configuration
  database-name: "shopsphere_db"
  database-host: "postgres"
  database-port: "5432"

  # Application settings
  app-name: "ShopSphere"
  log-level: "info"
  max-connections: "100"

  # Feature flags
  enable-caching: "true"
  enable-metrics: "true"

  # Nginx configuration (multi-line)
  nginx.conf: |
    server {
        listen 80;
        server_name localhost;

        location / {
            root /usr/share/nginx/html;
            index index.html;
        }

        location /api/ {
            proxy_pass <http://backend:5000>;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
```

### Complete Secret

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: shopsphere
type: Opaque
stringData:  # stringData allows plain text (auto base64 encoded)
  database-url: "postgresql://postgres:SecureP@ssw0rd123!@postgres:5432/shopsphere_db"
  api-key: "sk-prod-1234567890abcdef"
  jwt-secret: "super-secret-jwt-key-change-in-production"
data:  # data requires base64 encoding
  password: U2VjdXJlUEBzc3cwcmQxMjMh  # SecureP@ssw0rd123!
```

### Using ConfigMap in Deployment

```yaml
# deployment-with-configmap.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: shopsphere
spec:
  template:
    spec:
      containers:
      - name: backend
        image: shopsphere-backend:latest

        # Method 1: Environment variables from ConfigMap
        env:
        - name: DATABASE_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: database-host
        - name: DATABASE_PORT
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: database-port

        # Method 2: All ConfigMap keys as env vars
        envFrom:
        - configMapRef:
            name: app-config

        # Method 3: Volume mount
        volumeMounts:
        - name: config-volume
          mountPath: /etc/config
          readOnly: true

      volumes:
      - name: config-volume
        configMap:
          name: app-config
          items:
          - key: nginx.conf
            path: nginx.conf
```

### Using Secret in Deployment

```yaml
# deployment-with-secret.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: shopsphere
spec:
  template:
    spec:
      containers:
      - name: backend
        image: shopsphere-backend:latest

        # Environment variables from Secret
        env:
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password

        # All secret keys as env vars
        envFrom:
        - secretRef:
            name: app-secrets

        # Volume mount for sensitive files
        volumeMounts:
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true

      volumes:
      - name: secret-volume
        secret:
          secretName: app-secrets
          defaultMode: 0400  # Read-only for owner
```

## Verification

```bash
# List ConfigMaps
kubectl get configmap -n shopsphere

# Describe ConfigMap
kubectl describe configmap app-config -n shopsphere

# List Secrets
kubectl get secret -n shopsphere

# Verify ConfigMap mounted in pod
kubectl exec -it -n shopsphere deployment/backend -- cat /etc/config/nginx.conf

# Verify environment variables
kubectl exec -it -n shopsphere deployment/backend -- env | grep DATABASE

# Verify Secret mounted
kubectl exec -it -n shopsphere deployment/backend -- ls -la /etc/secrets
kubectl exec -it -n shopsphere deployment/backend -- cat /etc/secrets/password
```

## Screenshots

**Secrets Manager Integration (Optional):**

```
🔗 Console Path: Secrets Manager → Secrets
✅ Create external secret
✅ Sync with Kubernetes Secret
✅ Automatic rotation enabled
```

## Troubleshooting

### Issue: CreateContainerConfigError

**Symptoms:**

```bash
kubectl describe pod -n shopsphere deployment/backend
Events:
  Warning  Failed  Error: configmap "app-config" not found
  Warning  Failed  Error: secret "postgres-secret" not found
```

**Root Cause:**

```
❌ ConfigMap/Secret not created before deployment
❌ Wrong namespace
❌ Typo in name reference
```

**Fix:**

```bash
# Create missing resources
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml

# Verify they exist
kubectl get configmap,secret -n shopsphere
```

### Issue: Permission denied reading secret

**Symptoms:**

```bash
kubectl exec -it -n shopsphere deployment/backend -- cat /etc/secrets/password
cat: /etc/secrets/password: Permission denied
```

**Root Cause:**

```
❌ Wrong defaultMode on secret volume
```

**Fix:**

```yaml
volumes:
- name: secret-volume
  secret:
    secretName: app-secrets
    defaultMode: 0400  # Read-only for owner (4 = read for owner)
```



```bash
# Check if ConfigMap exists
kubectl get configmap app-config -n shopsphere -o yaml

# Check if Secret exists
kubectl get secret postgres-secret -n shopsphere -o yaml

# Verify pod can resolve ConfigMap keys
kubectl exec -it -n shopsphere deployment/backend -- printenv | grep DATABASE

# Check volume mounts
kubectl describe pod -n shopsphere deployment/backend | grep -A 5 Mounts

# Test secret decoding
kubectl get secret postgres-secret -n shopsphere -o json | jq '.data | map_values(@base64d)'
```

---


---
← [Previous: Application Deployment]({{< relref "05-application-deployment" >}})  [Next: Backend Database Integration]({{< relref "07-backend-database-integration" >}}) →
## Lessons learned

- Document the exact commands and manifests you applied — rollback depends on knowing what changed.
- Verify each layer (network, storage, workload) before moving to the next phase.
- Keep IAM and secrets out of git; use Kubernetes Secrets or AWS Secrets Manager.
