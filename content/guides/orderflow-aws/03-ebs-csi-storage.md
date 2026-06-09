---
title: "EBS CSI and Storage"
description: "OrderFlow walkthrough — EBS CSI add-on and gp3 StorageClass."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - eks
  - ebs
  - storage
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 30
related:
  - guides/orderflow-aws
  - guides/shopsphere-eks/03-ebs-csi-driver
---

## Objective

Install the **EBS CSI Driver** as an EKS managed add-on (EKS Pod Identity) and define a **gp3** StorageClass for any pod-local volumes the API or worker need.

## Architecture

```
EKS Pod Identity
  → EBS CSI controller (kube-system)
  → gp3 StorageClass
  → PVC → EBS volume (when workloads request storage)
```

OrderFlow persists orders in **RDS**, not cluster volumes — but gp3 remains useful for temp/cache volumes and mirrors ShopSphere storage patterns.

## Commands

### Install EBS CSI add-on

```bash
aws eks create-addon \
  --cluster-name orderflow-cluster \
  --addon-name aws-ebs-csi-driver \
  --resolve-conflicts OVERWRITE

kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

## Manifests

### gp3 StorageClass

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "false"
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
parameters:
  type: gp3
  encrypted: "true"
```

```bash
kubectl apply -f storageclass-gp3.yaml
```

## Verification

```bash
kubectl get storageclass gp3
kubectl get pods -n kube-system | grep ebs-csi
# Expected: ebs-csi-controller and ebs-csi-node pods Running
```

## Troubleshooting

### PVC stays Pending

**Cause:** `WaitForFirstConsumer` delays binding until a pod is scheduled. Ensure a pod references the PVC and runs in a node AZ with available capacity.

### CSI pods CrashLoopBackOff

Verify the add-on version matches the cluster Kubernetes version and that Pod Identity / IAM permissions for the CSI service account are attached.

## Lessons learned

- Use **gp3** with encryption for new EBS volumes.
- `WaitForFirstConsumer` avoids provisioning volumes in the wrong AZ before the pod is placed.

---
← [Previous: EKS Cluster]({{< relref "02-eks-cluster" >}})  [Next: ECR Repositories]({{< relref "04-ecr-repositories" >}}) →
