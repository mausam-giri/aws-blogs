---
title: "Infrastructure Setup"
description: "OrderFlow walkthrough — VPC, subnets, NAT, and routing for EKS and RDS."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - vpc
  - networking
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 10
related:
  - guides/orderflow-aws
  - guides/shopsphere-eks
---

## Objective

Create **OrderFlowVpc** with public and private subnets, an Internet Gateway, a NAT Gateway, and route tables that support EKS nodes in private subnets and internet-facing ALBs in public subnets.

## Architecture

```
VPC: 16.0.0.0/16 (OrderFlowVpc)
├── PublicSubnet1, PublicSubnet2
│   ├── Internet Gateway
│   ├── NAT Gateway
│   └── ALB (created later by ingress controller)
│
├── PrivateSubnet1, PrivateSubnet2
│   ├── EKS worker nodes
│   ├── Application pods
│   └── RDS (private subnets only)
│
└── Route tables
    ├── Public: 0.0.0.0/0 → IGW
    └── Private: 0.0.0.0/0 → NAT Gateway
```

## Commands

### Option A: eksctl (recommended)

```bash
eksctl create cluster \
  --name orderflow-cluster \
  --region us-east-1 \
  --version 1.35 \
  --without-nodegroup \
  --vpc-cidr 16.0.0.0/16 \
  --vpc-public-subnets 16.0.0.0/20,16.0.16.0/20 \
  --vpc-private-subnets 16.0.32.0/20,16.0.48.0/20
```

### Option B: tag existing subnets for ALB discovery

```bash
# Public subnets — internet-facing ALBs
aws ec2 create-tags \
  --resources subnet-PUBLIC1 subnet-PUBLIC2 \
  --tags \
    Key=kubernetes.io/cluster/orderflow-cluster,Value=shared \
    Key=kubernetes.io/role/elb,Value=1

# Private subnets — internal load balancers
aws ec2 create-tags \
  --resources subnet-PRIVATE1 subnet-PRIVATE2 \
  --tags \
    Key=kubernetes.io/cluster/orderflow-cluster,Value=shared \
    Key=kubernetes.io/role/internal-elb,Value=1
```

## Manifests

Subnet tags are not Kubernetes manifests but are required before Phase 05:

| Subnet type | Tag | Value |
|-------------|-----|-------|
| Public | `kubernetes.io/role/elb` | `1` |
| Private | `kubernetes.io/role/internal-elb` | `1` |
| Both | `kubernetes.io/cluster/orderflow-cluster` | `shared` |

## Verification

```bash
aws ec2 describe-vpcs \
  --filters "Name=tag:Name,Values=OrderFlowVpc" \
  --query 'Vpcs[*].{Id:VpcId,Cidr:CidrBlock}'

aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[*].{Id:SubnetId,Az:AvailabilityZone,Tags:Tags}'

aws ec2 describe-nat-gateways \
  --filter "Name=vpc-id,Values=$VPC_ID" \
  --query 'NatGateways[*].State'
```

**Expected:** one VPC `16.0.0.0/16`, two public and two private subnets, NAT Gateway `available`, public route to IGW, private route to NAT.

## Troubleshooting

### Private nodes cannot pull images

**Symptoms:** `ErrImagePull` / `ImagePullBackOff` on pods in private subnets.

**Fix:** Confirm NAT Gateway is in a **public** subnet and the private route table has `0.0.0.0/0 → nat-xxx`.

```bash
aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'RouteTables[*].Routes'
```

## Lessons learned

- Place EKS nodes and RDS in **private** subnets; only ALB and NAT live in public subnets.
- Tag subnets for the ALB controller **before** installing the controller (Phase 05).
- NAT is required for private nodes to reach ECR and package repositories.

---
[Next: EKS Cluster]({{< relref "02-eks-cluster" >}}) →
