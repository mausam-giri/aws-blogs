---
title: "EKS Cluster Creation"
description: "ShopSphere EKS walkthrough — EKS Cluster Creation."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - kubernetes
  - eksctl
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 20
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Create an Amazon EKS cluster with managed node groups and verify node connectivity.

## Architecture

```
EKS Control Plane (AWS Managed)
├── API Server
├── etcd
└── Controllers

Managed Node Group
├── m5.large (2 vCPU, 8 GiB)
├── Auto-scaling: 2-4 nodes
└── Private subnets only
```

## Commands

### Create EKS Cluster

```bash
# Using eksctl (Recommended)
eksctl create cluster \
  --name shopsphere \
  --region us-east-1 \
  --version 1.27 \
  --nodegroup-name standard-workers \
  --node-type m5.large \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 4 \
  --node-volume-size 20 \
  --ssh-access \
  --ssh-public-key my-key-pair \
  --managed \
  --with-oidc \
  --full-ecr-access \
  --appmesh-access \
  --alb-ingress-access
```

### Alternative: Terraform

```hcl
# main.tf
module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  version         = "~> 19.0"

  cluster_name    = "shopsphere"
  cluster_version = "1.27"

  vpc_id          = aws_vpc.main.id
  subnet_ids      = aws_subnet.private[*].id

  eks_managed_node_groups = {
    standard = {
      min_size     = 2
      max_size     = 4
      desired_size = 2

      instance_types = ["m5.large"]
      capacity_type  = "ON_DEMAND"
    }
  }
}
```

## Manifests

### Node Group Configuration

```yaml
# nodegroup.yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: shopsphere
  region: us-east-1
  version: "1.27"

managedNodeGroups:
  - name: standard-workers
    instanceType: m5.large
    desiredCapacity: 2
    minSize: 2
    maxSize: 4
    volumeSize: 20
    privateNetworking: true
    labels:
      role: workers
    tags:
      environment: production
```

## Verification

```bash
# Update kubeconfig
aws eks update-kubeconfig --name shopsphere --region us-east-1

# Verify nodes
kubectl get nodes -o wide

# Verify system pods
kubectl get pods -n kube-system

# Check cluster info
kubectl cluster-info
```

**Expected Output:**

```bash
NAME                         STATUS   ROLES    AGE   VERSION
ip-10-0-128-1.ec2.internal   Ready    <none>   5m    v1.27.3-eks
ip-10-0-160-1.ec2.internal   Ready    <none>   5m    v1.27.3-eks
```

## Screenshots

**EKS Cluster Dashboard:**

```
🔗 Console Path: EKS → Clusters → shopsphere
✅ Status: ACTIVE
✅ Kubernetes version: 1.27
✅ Platform version: eks.5
```

**Node Group View:**

```
🔗 Console Path: EKS → Clusters → shopsphere → Configuration → Compute
✅ Desired: 2
✅ Current: 2
✅ Status: ACTIVE
```

## Troubleshooting

### Issue: Nodes never join cluster

**Symptoms:**

```bash
kubectl get nodes
# No resources found
# OR
kubectl get nodes
NAME     STATUS     ROLES    AGE   VERSION
node-1   NotReady   <none>   10m   v1.27.3
```

**Root Causes:**

```
❌ Wrong subnet selection (public instead of private)
❌ Missing IAM permissions for node role
❌ Security group blocking node-to-control-plane traffic
❌ CNI plugin not installed
```

**Fix:**

```bash
# Check node group status
aws eks describe-nodegroup \
  --cluster-name shopsphere \
  --nodegroup-name standard-workers

# Check events
kubectl get events --sort-by='.lastTimestamp'

# Verify security groups
aws ec2 describe-security-groups \
  --filters "Name=tag:aws:eks:cluster-name,Values=shopsphere"
```



```bash
# Describe nodes for detailed info
kubectl describe node <node-name>

# Check kubelet logs on node
aws ssm start-session --target <instance-id>
sudo journalctl -u kubelet -f

# Verify IAM role
aws iam get-role --role-name eksctl-shopsphere-nodegroup-NodeInstanceRole
```

---


---
← [Previous: Infrastructure Setup]({{< relref "01-infrastructure-setup" >}})  [Next: EBS CSI Driver]({{< relref "03-ebs-csi-driver" >}}) →
## Lessons learned

- Document the exact commands and manifests you applied — rollback depends on knowing what changed.
- Verify each layer (network, storage, workload) before moving to the next phase.
- Keep IAM and secrets out of git; use Kubernetes Secrets or AWS Secrets Manager.
