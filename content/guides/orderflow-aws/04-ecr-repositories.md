---
title: "ECR Repositories"
description: "OrderFlow walkthrough — ECR repos, image scanning, and immutable tags."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - ecr
  - containers
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 40
related:
  - guides/orderflow-aws
  - posts/eks-ecr-best-practices
---

## Objective

Create ECR repositories for **orderflow/api**, **orderflow/frontend**, and **orderflow/worker** with image scanning on push and an immutable tagging strategy.

## Architecture

```
Developer workstation
  → docker build
  → ECR (scan on push)
  → EKS pulls via node IAM / private NAT
  → Deployments reference immutable tags (v1, git SHA)
```

## Commands

### Create repositories

```bash
for REPO in orderflow/api orderflow/frontend orderflow/worker; do
  aws ecr create-repository \
    --repository-name "$REPO" \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256
done
```

### Login and push API image

```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REGION=us-east-1

aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

docker build -t orderflow-api:v1 ./api
docker tag orderflow-api:v1 \
  $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/orderflow/api:v1
docker push $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/orderflow/api:v1
```

Repeat for `orderflow/frontend` and `orderflow/worker` when those Dockerfiles are ready.

## Manifests

Deployment image references (used in Phases 06 and 13):

```yaml
image: ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orderflow/api:v1
imagePullPolicy: IfNotPresent
```

## Verification

```bash
aws ecr describe-repositories \
  --query 'repositories[?starts_with(repositoryName, `orderflow/`)].repositoryName'

aws ecr describe-image-scan-findings \
  --repository-name orderflow/api \
  --image-id imageTag=v1 \
  --query 'imageScanFindings.findingSeverityCounts'
```

## Troubleshooting

### ImagePullBackOff after push

- Confirm tag in Deployment matches the pushed tag exactly (`v1`, not `latest`).
- Verify NAT connectivity from private nodes (Phase 01).
- Check ECR repository policy allows the node/instance role to pull.

## Lessons learned

- Avoid **`latest`** in production manifests — use `v1` or git SHA for traceable rollbacks.
- Enable **scanOnPush** before opening the registry to CI/CD.

---
← [Previous: EBS CSI and Storage]({{< relref "03-ebs-csi-storage" >}})  [Next: AWS Load Balancer Controller]({{< relref "05-aws-load-balancer-controller" >}}) →
