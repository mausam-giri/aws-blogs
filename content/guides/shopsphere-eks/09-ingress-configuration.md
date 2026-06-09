---
title: "Ingress Configuration"
description: "ShopSphere EKS walkthrough — Ingress Configuration."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - ingress
  - alb
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 90
related:
  - guides/shopsphere-eks
  - examples/shopsphere-ingress-variants
  - guides/kubernetes-on-aws
---

## Objective

Create Kubernetes Ingress resources to route external traffic to frontend and backend services through a single Application Load Balancer.

## Architecture

```
Internet
    ↓
Application Load Balancer (ALB)
├── Listener: HTTP (80)
│   └── Rules:
│       ├── Path: /api/* → backend:5000
│       ├── Path: /grafana → grafana:3000
│       └── Path: /* → frontend:80
│
└── Listener: HTTPS (443) [Optional with cert-manager]
    └── Same rules with SSL termination

Target Groups
├── tg-frontend (IP targets)
├── tg-backend (IP targets)
└── tg-grafana (IP targets)
```

## Commands

### Create Ingress

```bash
# Apply Ingress configuration
kubectl apply -f ingress.yaml

# Check Ingress status
kubectl get ingress -n shopsphere

# Wait for ALB to be created (2-5 minutes)
kubectl get ingress -n shopsphere -w

# Get ALB DNS name
ALB_DNS=$(kubectl get ingress shopsphere-ingress -n shopsphere \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "ALB DNS: $ALB_DNS"

# Test endpoints
curl http://$ALB_DNS/api/health
curl http://$ALB_DNS/api/products
curl http://$ALB_DNS/
```

### Test with kubectl

```bash
# Port-forward for local testing (alternative)
kubectl port-forward -n shopsphere svc/frontend 8080:80
curl <http://localhost:8080>

# Test backend directly
kubectl port-forward -n shopsphere svc/backend 5000:5000
curl <http://localhost:5000/api/health>
```

## Manifests

Canonical path-based ingress for `/api` and `/`. Alternate patterns (multi-host, Cognito auth, Grafana path): [ShopSphere Ingress Variants]({{< relref "examples/shopsphere-ingress-variants" >}}).

### Basic ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shopsphere-ingress
  namespace: shopsphere
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}]'
    alb.ingress.kubernetes.io/healthcheck-path: /api/health
spec:
  rules:
  - http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 5000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

## Verification

```bash
# Check Ingress resource
kubectl get ingress -n shopsphere

# Expected output:
# NAME                 CLASS   HOSTS   ADDRESS                                               PORTS   AGE
# shopsphere-ingress   alb     *       k8s-shops-shopspher-xxxxx-1234567890.us-east-1.elb.amazonaws.com   80      5m

# Describe Ingress for events
kubectl describe ingress shopsphere-ingress -n shopsphere

# Expected events:
# Normal   Created             Ingress   Ingress shopsphere/shopsphere-ingress
# Normal   Created             Ingress   LoadBalancer created

# Check ALB in AWS
ALB_DNS=$(kubectl get ingress shopsphere-ingress -n shopsphere \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "Testing ALB: $ALB_DNS"

# Test all endpoints
echo "=== Frontend ==="
curl -I http://$ALB_DNS/

echo "=== Backend API ==="
curl http://$ALB_DNS/api/health

echo "=== Products ==="
curl http://$ALB_DNS/api/products

# Check target groups
aws elbv2 describe-target-groups \
  --query "TargetGroups[?contains(TargetGroupName, 'k8s-shops')].TargetGroupName"

# Check ALB listeners
aws elbv2 describe-listeners \
  --load-balancer-arn $(aws elbv2 describe-load-balancers \
    --query "LoadBalancers[?DNSName=='$ALB_DNS'].LoadBalancerArn" --output text)
```


## Troubleshooting

### Issue: Ingress ADDRESS is empty

**Symptoms:**

```bash
kubectl get ingress -n shopsphere
NAME                 CLASS   HOSTS   ADDRESS   PORTS   AGE
shopsphere-ingress   alb     *                 80      10m

kubectl describe ingress shopsphere-ingress -n shopsphere
Events:
  Warning  FailedDeployModel  Failed deploy model due to
  ListenerNotFound: Listener 'arn:aws:elasticloadbalancing:...' not found
```

**Root Causes:**

```
❌ AWS Load Balancer Controller not running
❌ Missing subnet tags
❌ IAM permissions issue
```

**Fix:**

```bash
# Check controller is running
kubectl get pods -n kube-system | grep aws-load-balancer-controller

# Check controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=50

# Verify subnet tags (see Phase 8)
aws ec2 describe-subnets --filters "Name=tag:kubernetes.io/role/elb,Values=1"
```

### Issue: 503 Service Unavailable

**Symptoms:**

```bash
curl http://$ALB_DNS/api/health
# 503 Service Temporarily Unavailable
```

**Root Causes:**

```
❌ Target group health checks failing
❌ Wrong service port
❌ Pods not ready
```

**Fix:**

```bash
# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>

# Expected:
# "State": "healthy"

# If unhealthy, check:
kubectl get pods -n shopsphere
kubectl describe pod -n shopsphere <pod-name>

# Verify service endpoints
kubectl get endpoints -n shopsphere

# Expected:
# NAME       ENDPOINTS         AGE
# backend    10.0.1.10:5000,10.0.1.11:5000   10m

# Check health check path
kubectl describe ingress shopsphere-ingress -n shopsphere | grep healthcheck

# Test health endpoint directly
kubectl run test --rm -it --image=curlimages/curl --namespace=shopsphere -- \
  curl <http://backend:5000/api/health>
```

### Issue: 404 Not Found

**Symptoms:**

```bash
curl http://$ALB_DNS/api/products
# 404 Not Found
```

**Root Cause:**

```
❌ Path not matching
❌ Service not found
```

**Fix:**

```bash
# Check pathType
kubectl get ingress shopsphere-ingress -n shopsphere -o yaml | grep pathType

# Use Prefix for /api/* matching
pathType: Prefix

# Verify service exists
kubectl get svc -n shopsphere backend

# Test service directly
kubectl run test --rm -it --image=curlimages/curl --namespace=shopsphere -- \
  curl <http://backend:5000/api/products>
```



```bash
# Check Ingress events
kubectl get events -n shopsphere --sort-by='.lastTimestamp' | grep -i ingress

# Check ALB logs (enable access logs first)
aws s3 ls s3://<alb-access-logs-bucket>/

# Describe target groups
aws elbv2 describe-target-groups \
  --query "TargetGroups[?contains(TargetGroupName, 'k8s-shops')].[TargetGroupName,HealthCheckPath,HealthCheckPort]"

# Check target health
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
  --query "TargetGroups[?contains(TargetGroupName, 'backend')].TargetGroupArn" --output text)

aws elbv2 describe-target-health --target-group-arn $TARGET_GROUP_ARN

# Test from within cluster
kubectl run debug --rm -it --image=nicolaka/netshoot --namespace=shopsphere -- bash
curl -v <http://backend:5000/api/health>

# Check AWS WAF logs (if enabled)
aws wafv2 get-web-acl-resource --scope REGIONAL --resource-arn <alb-arn>
```

---


---
← [Previous: AWS Load Balancer Controller]({{< relref "08-aws-load-balancer-controller" >}})  [Next: Frontend Application]({{< relref "10-frontend-application" >}}) →
## Lessons learned

- Document the exact commands and manifests you applied — rollback depends on knowing what changed.
- Verify each layer (network, storage, workload) before moving to the next phase.
- Keep IAM and secrets out of git; use Kubernetes Secrets or AWS Secrets Manager.
