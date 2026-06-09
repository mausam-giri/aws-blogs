---
title: "EKS Cluster"
description: "OrderFlow walkthrough — orderflow-cluster, node group, logging, and OIDC."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - eks
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 20
related:
  - guides/orderflow-aws
  - guides/kubernetes-on-aws
---

## Objective

Create **orderflow-cluster** (Kubernetes 1.35) with a managed node group in private subnets, control-plane logging enabled, and an OIDC provider for IRSA.

## Architecture

```
orderflow-cluster (EKS 1.35)
├── Control plane (public + private endpoint)
├── Managed node group: primary-ng
│   ├── Instance type: t3.small
│   ├── Scaling: min 2, desired 2, max 4
│   └── Subnets: private only
└── OIDC provider → IRSA (Phases 05, 09, 13)
```

## Commands

### Create node group (if cluster created with --without-nodegroup)

```bash
eksctl create nodegroup \
  --cluster orderflow-cluster \
  --region us-east-1 \
  --name primary-ng \
  --node-type t3.small \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 4 \
  --node-private-networking
```

### Enable control-plane logging

```bash
aws eks update-cluster-config \
  --name orderflow-cluster \
  --logging '{"clusterLogging":[{"types":["api","audit","authenticator","controllerManager","scheduler"],"enabled":true}]}'
```

### Associate OIDC provider

```bash
eksctl utils associate-iam-oidc-provider \
  --cluster orderflow-cluster \
  --region us-east-1 \
  --approve
```

### Configure kubectl

```bash
aws eks update-kubeconfig --name orderflow-cluster --region us-east-1
kubectl get nodes -o wide
```

## Manifests

No application manifests in this phase. Cluster logging and endpoint access are AWS API settings.

## Verification

```bash
aws eks describe-cluster --name orderflow-cluster \
  --query 'cluster.{Status:status,Version:version,OIDC:identity.oidc.issuer,Logging:logging.clusterLogging}'

aws iam list-open-id-connect-providers | grep orderflow-cluster

kubectl get nodes
# Expected: 2 nodes, STATUS Ready, internal IPs in private CIDR
```

## Troubleshooting

### Nodes NotReady

```bash
kubectl describe node <node-name>
aws ec2 describe-instances --filters "Name=tag:eks:nodegroup-name,Values=primary-ng"
```

Common causes: insufficient subnet IP space, missing NAT (Phase 01), or security group blocking node communication.

### OIDC provider missing

IRSA and the ALB controller fail without OIDC. Re-run `eksctl utils associate-iam-oidc-provider` and verify the issuer URL matches the cluster describe output.

## Lessons learned

- Keep worker nodes in **private** subnets; expose workloads via ALB Ingress, not public node IPs.
- Enable audit and API logs early — they help debug IRSA and admission issues later.
- Standardize on Kubernetes **1.35** across kubectl, add-ons, and node AMIs.

---
← [Previous: Infrastructure Setup]({{< relref "01-infrastructure-setup" >}})  [Next: EBS CSI and Storage]({{< relref "03-ebs-csi-storage" >}}) →
