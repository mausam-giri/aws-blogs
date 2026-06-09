---
title: "Advanced Autoscaling with Karpenter"
description: "ShopSphere EKS walkthrough — Advanced Autoscaling with Karpenter."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - karpenter
  - autoscaling
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 160
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Implement Karpenter to automatically provision and terminate EC2 instances based on pending pod demands, replacing or complementing the legacy Cluster Autoscaler with faster, more cost-effective node scaling.

## Architecture

```
Pending Pods (e.g., from HPA)
  ↓
Karpenter Controller (watches unschedulable pods)
  ↓
Evaluates NodePool & EC2NodeClass
  ↓
EC2 Fleet API (provisions exact instance type needed)
  ↓
Node joins cluster, Pod is scheduled
```

## Commands

### Prerequisites: IAM Roles

Karpenter requires an IAM role for the nodes it launches and an IRSA for the controller.

```bash
# Create Karpenter Node IAM Role (via eksctl or CloudFormation)
# Note: Refer to Karpenter docs for the exact CloudFormation template URL for your EKS version.

# Create IRSA for Karpenter Controller
eksctl create iamserviceaccount \
  --cluster shopsphere \
  --name karpenter \
  --namespace karpenter \
  --role-name KarpenterControllerRole-shopsphere \
  --attach-policy-arn arn:aws:iam::123456789012:policy/KarpenterControllerPolicy \
  --approve
```

### Install Karpenter via Helm

```bash
helm repo add karpenter <https://charts.karpenter.sh>
helm repo update

helm upgrade --install karpenter karpenter/karpenter \
  --namespace karpenter --create-namespace \
  --set settings.clusterName=shopsphere \
  --set settings.clusterEndpoint=$(aws eks describe-cluster --name shopsphere --query "cluster.endpoint" --output text) \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=arn:aws:iam::123456789012:role/KarpenterControllerRole-shopsphere \
  --wait
```

## Manifests

### EC2NodeClass (AWS Specific Configuration)

```yaml
# karpenter/ec2-node-class.yaml
apiVersion: karpenter.k8s.aws/v1beta1
kind: EC2NodeClass
metadata:
  name: default
spec:
  amiFamily: AL2
  role: "KarpenterNodeRole-shopsphere" # The IAM role for the EC2 instances
  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: shopsphere # Tag your private subnets with this!
  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: shopsphere # Tag your node SG with this!
  instanceProfile: "KarpenterNodeInstanceProfile-shopsphere" # If not using role directly
  tags:
    karpenter.sh/discovery: shopsphere
```

### NodePool (Generic Kubernetes Constraints)

```yaml
# karpenter/node-pool.yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      requirements:
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
        - key: kubernetes.io/os
          operator: In
          values: ["linux"]
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand"] # Change to "spot" for cost savings
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["c", "m", "r"]
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["2"]
      nodeClassRef:
        name: default
  limits:
    cpu: 1000 # Max CPU across all Karpenter nodes
  disruption:
    consolidationPolicy: WhenUnderutilized
    expireAfter: 720h # 30 days
```

## Verification

```bash
# 1. Apply the Karpenter resources
kubectl apply -f karpenter/ec2-node-class.yaml
kubectl apply -f karpenter/node-pool.yaml

# 2. Create a dummy deployment that requires more CPU than currently available
kubectl run stress-test --image=nginx --requests='cpu=5' -n shopsphere

# 3. Watch Karpenter provision a node
kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter -f
# Expected: "Launching node with instance type m5.xlarge..."

kubectl get nodes -w
```

## Troubleshooting

### Issue: Karpenter fails to launch instances

**Cause:** Subnets or Security Groups are not tagged with `karpenter.sh/discovery: shopsphere`, or the Node IAM role lacks permissions to join the EKS cluster.
**Fix:** Verify AWS tags and ensure the `aws-auth` ConfigMap includes the Karpenter Node IAM role.

## Lessons learned

✅ **Karpenter is faster and cheaper** than Cluster Autoscaler because it evaluates pending pods and launches the *exact* right instance type, rather than just scaling up an existing Auto Scaling Group.

✅ **Tagging is everything.** Both the AWS Load Balancer Controller and Karpenter rely heavily on specific AWS resource tags.

---


---
← [Previous: Application Metrics]({{< relref "15-application-metrics" >}})  [Next: GitOps Deployment with ArgoCD]({{< relref "17-gitops-argocd" >}}) →
