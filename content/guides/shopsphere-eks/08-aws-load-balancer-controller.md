---
title: "AWS Load Balancer Controller"
description: "ShopSphere EKS walkthrough — AWS Load Balancer Controller."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - alb
  - irsa
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 80
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Install and configure the AWS Load Balancer Controller to automatically provision Application Load Balancers (ALB) for Kubernetes Ingress resources.

## Architecture

```
Kubernetes Cluster
├── AWS Load Balancer Controller
│   ├── Deployment (kube-system)
│   ├── ServiceAccount (IRSA)
│   └── IAM Role (with permissions)
│
└── Ingress Resources
    ↓
Controller watches for Ingress
    ↓
Creates ALB via AWS API
    ↓
Configures Target Groups
    ↓
Routes traffic to Pods
```

## Commands

### Step 1: Associate OIDC Provider

```bash
eksctl utils associate-iam-oidc-provider \
  --cluster shopsphere \
  --region us-east-1 \
  --approve
```

**Verify:**

```bash
aws iam list-open-id-connect-providers | grep shopsphere
# Expected: arn:aws:iam::<account-id>:oidc-provider/oidc.eks.us-east-1.amazonaws.com/id/XXXXX
```

### Step 2: Create IAM Policy

```bash
# Download policy
curl -O <https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json>

# Create IAM policy
aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam_policy.json

# Get policy ARN
POLICY_ARN=$(aws iam list-policies \
  --query "Policies[?PolicyName=='AWSLoadBalancerControllerIAMPolicy'].Arn" \
  --output text)

echo $POLICY_ARN
```

### Step 3: Create IAM Service Account

```bash
eksctl create iamserviceaccount \
  --cluster=shopsphere \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=$POLICY_ARN \
  --override-existing-serviceaccounts \
  --approve
```

**Verify:**

```bash
kubectl get sa aws-load-balancer-controller -n kube-system -o yaml | grep annotations
# Expected: eks.amazonaws.com/role-arn: arn:aws:iam::...
```

### Step 4: Install Controller via Helm

```bash
# Add Helm repo
helm repo add eks <https://aws.github.io/eks-charts>
helm repo update

# Get VPC ID
VPC_ID=$(aws eks describe-cluster \
  --name shopsphere \
  --query "cluster.resourcesVpcConfig.vpcId" \
  --output text)

echo "VPC ID: $VPC_ID"

# Install controller
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=shopsphere \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=us-east-1 \
  --set vpcId=$VPC_ID \
  --set replicaCount=2 \
  --set resources.requests.cpu=100m \
  --set resources.requests.memory=128Mi
```

## Manifests

### Alternative: Manual Installation (without Helm)

```yaml
# aws-load-balancer-controller.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aws-load-balancer-controller
  namespace: kube-system
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::<account-id>:role/AmazonEKSLoadBalancerControllerRole
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aws-load-balancer-controller
  namespace: kube-system
  labels:
    app.kubernetes.io/name: aws-load-balancer-controller
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: aws-load-balancer-controller
  template:
    metadata:
      labels:
        app.kubernetes.io/name: aws-load-balancer-controller
    spec:
      serviceAccountName: aws-load-balancer-controller
      containers:
      - name: controller
        image: public.ecr.aws/eks/aws-load-balancer-controller:v2.5.4
        args:
        - --cluster-name=shopsphere
        - --ingress-class=alb
        - --aws-vpc-id=<vpc-id>
        - --aws-region=us-east-1
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
```

## Verification

```bash
# Check controller pods
kubectl get pods -n kube-system | grep aws-load-balancer-controller

# Expected:
# aws-load-balancer-controller-6d8f9b7c4-abc12   1/1     Running   0   5m
# aws-load-balancer-controller-6d8f9b7c4-def34   1/1     Running   0   5m

# Check logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=20

# Expected:
# {"level":"info","ts":1686139200.123,"msg":"version","GitVersion":"v2.5.4"}
# {"level":"info","ts":1686139200.456,"msg":"starting manager"}

# Verify webhook is ready
kubectl get validatingwebhookconfiguration ingress-class-validator -o yaml

# Test by creating an Ingress (see Phase 9)
```

## Screenshots

**EC2 Load Balancers:**

```
🔗 Console Path: EC2 → Load Balancers
✅ After creating Ingress, ALB appears here
✅ Type: Application
✅ Scheme: internet-facing
✅ State: active
```

**Target Groups:**

```
🔗 Console Path: EC2 → Target Groups
✅ Automatically created for each Ingress
✅ Type: IP
✅ Protocol: HTTP
✅ Health checks configured
```

## Troubleshooting

### Issue: AccessDenied errors in logs

**Symptoms:**

```bash
kubectl logs -n kube-system deployment/aws-load-balancer-controller
{"level":"error","ts":1686139200,"msg":"failed to describe subnets",
"error":"AccessDenied: User: arn:aws:sts::123456789012:assumed-role/...
is not authorized to perform: ec2:DescribeSubnets"}
```

**Root Causes:**

```
❌ IRSA not configured correctly
❌ Missing IAM policy
❌ Wrong service account annotation
```

**Fix:**

```bash
# Verify service account has correct annotation
kubectl get sa aws-load-balancer-controller -n kube-system -o yaml

# Verify IAM role trust relationship
aws iam get-role \
  --role-name eksctl-shopsphere-addon-iamserviceaccount-kube-system-aws-load-balancer-controller

# Should include:
# "Condition": {
#   "StringEquals": {
#     "oidc.eks.us-east-1.amazonaws.com/id/XXXXX:sub": "system:serviceaccount:kube-system:aws-load-balancer-controller"
#   }
# }

# Re-create service account if needed
eksctl delete iamserviceaccount \
  --cluster=shopsphere \
  --namespace=kube-system \
  --name=aws-load-balancer-controller

eksctl create iamserviceaccount \
  --cluster=shopsphere \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=$POLICY_ARN \
  --override-existing-serviceaccounts \
  --approve
```

### Issue: No subnets found

**Symptoms:**

```bash
kubectl logs -n kube-system deployment/aws-load-balancer-controller
{"level":"error","msg":"failed to build load balancer",
"error":"couldn't find any subnets"}
```

**Root Cause:**

```
❌ Subnets not tagged correctly
```

**Fix:**

```bash
# Tag public subnets for internet-facing ALBs
aws ec2 create-tags \
  --resources subnet-xxxxx subnet-yyyyy \
  --tags Key=kubernetes.io/cluster/shopsphere,Value=shared \
  Key=kubernetes.io/role/elb,Value=1

# Tag private subnets for internal ALBs
aws ec2 create-tags \
  --resources subnet-zzzzz subnet-aaaaa \
  --tags Key=kubernetes.io/cluster/shopsphere,Value=shared \
  Key=kubernetes.io/role/internal-elb,Value=1

# Verify tags
aws ec2 describe-subnets \
  --filters "Name=tag:kubernetes.io/cluster/shopsphere,Values=shared"
```



```bash
# Check controller events
kubectl get events -n kube-system --sort-by='.lastTimestamp' | grep -i "load.balancer"

# Describe ingress for events
kubectl describe ingress <ingress-name> -n shopsphere

# Check AWS API calls (CloudTrail)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=CreateLoadBalancer \
  --max-results 5

# Verify VPC configuration
aws ec2 describe-vpcs --vpc-ids $VPC_ID
aws ec2 describe-internet-gateways \
  --filters "Name=attachment.vpc-id,Values=$VPC_ID"

# Check subnet tags
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query "Subnets[*].[SubnetId,Tags]"
```

## Lessons learned

✅ **Always tag subnets correctly** (most common issue)

✅ **Use IRSA** (not node IAM roles)

✅ **Deploy 2 replicas** (high availability)

✅ **Set resource limits** (prevent resource starvation)

✅ **Check CloudTrail for AWS API errors**

✅ **Use ingress-class: alb** annotation

✅ **Verify OIDC provider is associated**

✅ **Test with simple Ingress first**

---


---
← [Previous: Backend Database Integration]({{< relref "07-backend-database-integration" >}})  [Next: Ingress Configuration]({{< relref "09-ingress-configuration" >}}) →
