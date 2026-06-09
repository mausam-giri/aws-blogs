---
title: "OrderFlow on AWS"
description: "14-phase walkthrough migrating ShopSphere to RDS, SQS, SNS, DynamoDB, and IRSA on EKS."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
weight: 15
bookCollapseSection: true
tags:
  - orderflow
  - alb
  - rds
  - sqs
  - sns
  - dynamodb
  - irsa
  - microservices
  - walkthrough
  - event-driven
related:
  - guides/shopsphere-eks
  - examples/orderflow-snippets
  - examples/lambda-event-pipeline
  - examples/iam-policies
  - guides/data-on-aws
---

> Migrate ShopSphere from in-cluster PostgreSQL to managed RDS, Secrets Manager, and an event-driven pipeline with SQS, SNS, and DynamoDB on EKS.

**Prerequisite:** Complete [ShopSphere on Amazon EKS]({{< relref "guides/shopsphere-eks" >}}) first — OrderFlow reuses EKS networking, ingress, and deployment patterns.

**Snippets:** [OrderFlow CLI and config]({{< relref "examples/orderflow-snippets" >}}) · [IAM policies]({{< relref "examples/iam-policies" >}})

## Migration at a glance

| ShopSphere (K8s-native) | OrderFlow (AWS-managed) |
|---------------------------|-------------------------|
| PostgreSQL StatefulSet + EBS | RDS PostgreSQL (`orderflow-db`) |
| Kubernetes Secrets in Git | Secrets Manager + IRSA |
| Synchronous API only | API → RDS + SQS → worker → SNS/DynamoDB |

## Final architecture

```mermaid
flowchart TB
    User[User] --> ALB[ALB via Ingress]
    ALB --> API[orderflow-api]
    API --> RDS[(RDS PostgreSQL)]
    API --> SQS[SQS orderflow-orders]
    SQS --> Worker[orderflow-worker]
    Worker --> SNS[SNS orderflow-notifications]
    Worker --> DDB[(DynamoDB orderflow-events)]
    API -.-> SM[Secrets Manager]
    SM -.-> RDS
    subgraph EKS[orderflow-cluster]
        API
        Worker
    end
```

## Phases

| Phase | Topic |
|-------|-------|
| 01 | [Infrastructure Setup]({{< relref "01-infrastructure-setup" >}}) — VPC, subnets, NAT, routing |
| 02 | [EKS Cluster]({{< relref "02-eks-cluster" >}}) — control plane, node group, OIDC |
| 03 | [EBS CSI and Storage]({{< relref "03-ebs-csi-storage" >}}) — add-on and gp3 StorageClass |
| 04 | [ECR Repositories]({{< relref "04-ecr-repositories" >}}) — API, frontend, worker images |
| 05 | [AWS Load Balancer Controller]({{< relref "05-aws-load-balancer-controller" >}}) — IRSA and Helm install |
| 06 | [API Deployment]({{< relref "06-api-deployment" >}}) — namespace, Deployment, Service |
| 07 | [Ingress Configuration]({{< relref "07-ingress-configuration" >}}) — ALB and path routing |
| 08 | [RDS PostgreSQL]({{< relref "08-rds-postgresql" >}}) — private database and security groups |
| 09 | [Secrets Manager and IRSA]({{< relref "09-secrets-manager-irsa" >}}) — API credentials without K8s secrets |
| 10 | [API and Database Integration]({{< relref "10-api-database-integration" >}}) — schema, endpoints, health checks |
| 11 | [SQS Queue Integration]({{< relref "11-sqs-integration" >}}) — async order enqueue from API |
| 12 | [SNS and DynamoDB]({{< relref "12-sns-dynamodb" >}}) — notifications and event store |
| 13 | [Worker Deployment]({{< relref "13-worker-deployment" >}}) — queue consumer and IAM |
| 14 | [CloudWatch Observability]({{< relref "14-cloudwatch-observability" >}}) — logs and Container Insights |
| 15 | [Roadmap]({{< relref "15-roadmap" >}}) — CloudFront, WAF, CI/CD, EventBridge |

**See also:** [Kubernetes on AWS]({{< relref "guides/kubernetes-on-aws" >}}) · [Lambda event pipeline]({{< relref "examples/lambda-event-pipeline" >}})
