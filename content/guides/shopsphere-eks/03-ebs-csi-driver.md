---
title: "EBS CSI Driver"
description: "ShopSphere EKS walkthrough — EBS CSI Driver."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - ebs
  - storage
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 30
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Install the Amazon EBS CSI driver to enable dynamic provisioning of persistent volumes for stateful workloads like databases.

## Architecture

```
Kubernetes Cluster
├── EBS CSI Controller (Deployment)
│   ├── csi-provisioner
│   ├── csi-attacher
│   └── ebs-plugin
│
└── EBS CSI Node (DaemonSet)
    ├── node-driver-registrar
    └── ebs-plugin

StorageClass (gp3)
    ↓
PVC Request
    ↓
EBS Volume (gp3, 10Gi)
    ↓
Pod Mount
```

## Commands

### Install EBS CSI Driver

```bash
# Method 1: Using eksctl (Easiest)
eksctl create addon \
  --name aws-ebs-csi-driver \
  --cluster shopsphere \
  --version latest \
  --force

# Method 2: Using Helm
helm repo add aws-ebs-csi-driver \
  <https://kubernetes-sigs.github.io/aws-ebs-csi-driver>

helm install aws-ebs-csi-driver aws-ebs-csi-driver/aws-ebs-csi-driver \
  --namespace kube-system \
  --set controller.serviceAccount.create=true \
  --set controller.serviceAccount.name=ebs-csi-controller-sa

# Method 3: Using kubectl (IAM role required)
kubectl apply -k "github.com/kubernetes-sigs/aws-ebs-csi-driver/deploy/kubernetes/overlays/stable/?ref=master"
```

### Create IAM Role for Service Account (if not using addon)

```bash
eksctl create iamserviceaccount \
  --name ebs-csi-controller-sa \
  --namespace kube-system \
  --cluster shopsphere \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
  --approve \
  --role-only \
  --role-name AmazonEKS_EBS_CSI_DriverRole
```

## Manifests

### StorageClass Configuration

```yaml
# storageclass.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
parameters:
  type: gp3
  fsType: ext4
  encrypted: "true"
  kmsKeyId: "arn:aws:kms:us-east-1:123456789012:key/xxxx"  # Optional
reclaimPolicy: Retain  # Keep data after PVC deletion
```

### Verify Installation

```yaml
# test-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ebs-test-claim
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: gp3
---
apiVersion: v1
kind: Pod
metadata:
  name: ebs-test-app
spec:
  containers:
  - name: app
    image: centos
    command: ["/bin/sh"]
    args: ["-c", "while true; do echo $(date -u) >> /data/out.txt; sleep 5; done"]
    volumeMounts:
    - name: persistent-storage
      mountPath: /data
  volumes:
  - name: persistent-storage
    persistentVolumeClaim:
      claimName: ebs-test-claim
```

## Verification

```bash
# Check CSI driver pods
kubectl get pods -n kube-system | grep ebs-csi

# Expected output:
# ebs-csi-controller-xxxxx   6/6     Running   0          5m
# ebs-csi-node-xxxxx         3/3     Running   0          5m

# Verify StorageClass
kubectl get storageclass

# Expected:
# NAME            PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
# gp3 (default)   ebs.csi.aws.com         Retain          WaitForFirstConsumer   true                   5m

# Test PVC creation
kubectl apply -f test-pvc.yaml
kubectl get pvc
kubectl get pv

# Expected:
# NAME             STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# ebs-test-claim   Bound    pvc-12345678-1234-1234-1234-123456789012   1Gi        RWO            gp3            30s
```

## Screenshots

**EKS Add-ons View:**

```
🔗 Console Path: EKS → Clusters → shopsphere → Add-ons
✅ aws-ebs-csi-driver: Active
✅ Version: v1.20.0-eksbuild.1
```

**EC2 Volumes:**

```
🔗 Console Path: EC2 → Elastic Block Store → Volumes
✅ Volume ID: vol-0xxxx
✅ State: in-use
✅ Size: 1 GiB
✅ Type: gp3
✅ Attached to: i-0xxxx (EKS node)
```

## Troubleshooting

### Issue: PVC remains in Pending state

**Symptoms:**

```bash
kubectl get pvc
NAME             STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
postgres-pvc     Pending                                      gp3            5m

kubectl describe pvc postgres-pvc
Events:
  Warning  ProvisioningFailed  2m  ebs.csi.aws.com_gp3
  failed to provision volume with StorageClass "gp3":
  rpc error: code = Internal desc = Could not attach volume
```

**Root Causes:**

```
❌ EBS CSI Driver not installed
❌ IAM permissions missing
❌ No nodes available in AZ
❌ Volume limit reached (max 39 volumes per node)
```

**Fix:**

```bash
# Check if CSI driver is running
kubectl get pods -n kube-system | grep ebs-csi

# Check CSI driver logs
kubectl logs -n kube-system deployment/ebs-csi-controller

# Verify IAM role (if using IRSA)
kubectl get sa ebs-csi-controller-sa -n kube-system -o yaml

# Check node availability
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.labels.topology\.kubernetes\.io/zone}{"\n"}{end}'
```



```bash
# Check events for PVC
kubectl describe pvc <pvc-name>

# Check CSI controller logs
kubectl logs -n kube-system deployment/ebs-csi-controller -c csi-provisioner

# Check node plugin logs
kubectl logs -n kube-system <ebs-csi-node-pod-name> -c node-driver-registrar

# Verify AWS permissions
aws ec2 describe-volumes --filters "Name=tag:kubernetes.io/created-for/pvc/name,Values=<pvc-name>"
```

---


---
← [Previous: EKS Cluster Creation]({{< relref "02-eks-cluster" >}})  [Next: PostgreSQL Persistence]({{< relref "04-postgresql-persistence" >}}) →
## Lessons learned

- Document the exact commands and manifests you applied — rollback depends on knowing what changed.
- Verify each layer (network, storage, workload) before moving to the next phase.
- Keep IAM and secrets out of git; use Kubernetes Secrets or AWS Secrets Manager.
