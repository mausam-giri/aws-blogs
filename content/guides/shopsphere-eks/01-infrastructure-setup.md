---
title: "Infrastructure Setup"
description: "ShopSphere EKS walkthrough — Infrastructure Setup."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - vpc
  - networking
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 10
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Create a production-ready VPC with public and private subnets, internet gateway, NAT gateway, and proper routing for EKS workloads.

## Architecture

```
VPC: 10.0.0.0/16
├── Public Subnets (us-east-1a, 1b)
│   ├── Internet Gateway
│   └── ALBs
│
├── Private Subnets (us-east-1a, 1b)
│   ├── NAT Gateway
│   └── EKS Worker Nodes
│
└── Route Tables
    ├── Public: 0.0.0.0/0 → IGW
    └── Private: 0.0.0.0/0 → NAT
```

## Commands

### Create VPC using eksctl (Recommended)

```bash
# Create VPC with eksctl
eksctl create cluster \
  --name shopsphere \
  --region us-east-1 \
  --version 1.27 \
  --without-nodegroup \
  --vpc-private-subnets=10.0.0.0/19,10.0.32.0/19 \
  --vpc-public-subnets=10.0.64.0/19,10.0.96.0/19 \
  --vpc-cidr=10.0.0.0/16
```

### Or using AWS CLI

```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications \
  'ResourceType=vpc,Tags=[{Key=Name,Value=shopsphere-vpc}]'

# Create Internet Gateway
aws ec2 create-internet-gateway --tag-specifications \
  'ResourceType=internet-gateway,Tags=[{Key=Name,Value=shopsphere-igw}]'

# Attach IGW to VPC
aws ec2 attach-internet-gateway --internet-gateway-id igw-xxx --vpc-id vpc-xxx

# Create NAT Gateway in public subnet
aws ec2 allocate-address --domain vpc
aws ec2 create-nat-gateway --subnet-id subnet-xxx --allocation-id eipalloc-xxx
```

## Manifests

### VPC Tags for Kubernetes

```yaml
# Required tags for ALB controller
kubernetes.io/cluster/shopsphere: shared
kubernetes.io/role/elb: "1"  # Public subnets
kubernetes.io/role/internal-elb: "1"  # Private subnets
```

## Verification

```bash
# Verify VPC setup
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=shopsphere-vpc"

# Verify subnets
aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-xxx"

# Verify route tables
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-xxx"
```

**Expected Output:**

```
VPC: 10.0.0.0/16
Public Subnets: 2
Private Subnets: 2
Internet Gateway: Attached
NAT Gateway: 1 (in public subnet)
```

## Troubleshooting

### Issue: Private nodes cannot pull images

**Symptoms:**

```bash
kubectl describe pod <pod-name>
# Events:
# Failed to pull image: request canceled while waiting for connection
# ErrImagePull / ImagePullBackOff
```

**Root Cause:**

```
❌ Missing NAT Gateway
❌ Private route table not pointing to NAT
```

**Fix:**

```bash
# Verify NAT Gateway exists
aws ec2 describe-nat-gateways --filter "Name=vpc-id,Values=vpc-xxx"

# Update private route table
aws ec2 create-route \
  --route-table-id rtb-private-xxx \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id nat-xxx
```



```bash
# Test internet connectivity from private subnet
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t2.micro \
  --subnet-id subnet-private-xxx \
  --security-group-ids sg-xxx \
  --query 'Instances[0].InstanceId'

# Connect and test
aws ec2 describe-instance-status --instance-ids i-xxx
```

---


---
[Next: EKS Cluster Creation]({{< relref "02-eks-cluster" >}}) →
## Lessons learned

- Document the exact commands and manifests you applied — rollback depends on knowing what changed.
- Verify each layer (network, storage, workload) before moving to the next phase.
- Keep IAM and secrets out of git; use Kubernetes Secrets or AWS Secrets Manager.
