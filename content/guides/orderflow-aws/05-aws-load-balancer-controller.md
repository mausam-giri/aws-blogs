---
title: "AWS Load Balancer Controller"
description: "OrderFlow walkthrough — install ALB controller with IRSA on orderflow-cluster."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - alb
  - irsa
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 50
related:
  - guides/orderflow-aws
  - guides/shopsphere-eks/08-aws-load-balancer-controller
---

## Objective

Install the **AWS Load Balancer Controller** on **orderflow-cluster** using IRSA so Ingress resources provision Application Load Balancers automatically.

## Architecture

```
Ingress (orderflow namespace)
  → AWS Load Balancer Controller (kube-system, IRSA)
  → AWS ELB APIs
  → Internet-facing ALB → Target Group (pod IPs)
```

## Commands

### Download and create IAM policy

```bash
curl -fsSL -o iam_policy.json \
  https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.0/docs/install/iam_policy.json

aws iam create-policy \
  --policy-name AWSLoadBalancerControllerOrderFlowPolicy \
  --policy-document file://iam_policy.json

export POLICY_ARN=$(aws iam list-policies \
  --query "Policies[?PolicyName=='AWSLoadBalancerControllerOrderFlowPolicy'].Arn" \
  --output text)
```

### Create IRSA service account

```bash
eksctl create iamserviceaccount \
  --cluster=orderflow-cluster \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=$POLICY_ARN \
  --override-existing-serviceaccounts \
  --approve
```

### Install via Helm

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update

export VPC_ID=$(aws eks describe-cluster --name orderflow-cluster \
  --query "cluster.resourcesVpcConfig.vpcId" --output text)

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=orderflow-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=us-east-1 \
  --set vpcId=$VPC_ID \
  --set replicaCount=2
```

## Manifests

No Ingress yet — that is Phase 07. Confirm the controller Deployment references the IRSA service account.

## Verification

```bash
kubectl get deployment -n kube-system aws-load-balancer-controller
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=30
# Expected: manager started, no AccessDenied on ec2:DescribeSubnets
```

## Troubleshooting

### No subnets found

Subnet tags from Phase 01 are missing. Re-apply `kubernetes.io/role/elb=1` on public subnets.

### AccessDenied in controller logs

Re-create the IRSA service account and confirm trust policy `sub` matches `system:serviceaccount:kube-system:aws-load-balancer-controller`.

## Lessons learned

- Run **two controller replicas** for availability.
- Fix subnet tags before debugging Ingress — most ALB failures start with discovery, not Ingress YAML.

---
← [Previous: ECR Repositories]({{< relref "04-ecr-repositories" >}})  [Next: API Deployment]({{< relref "06-api-deployment" >}}) →
