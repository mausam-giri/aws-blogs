---
title: "ShopSphere on Amazon EKS"
description: "End-to-end walkthrough for building and operating a production-style microservices app on Amazon EKS."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
weight: 10
bookCollapseSection: true
tags:
  - shopsphere
  - eks
  - kubernetes
  - microservices
  - walkthrough
  - alb
  - observability
related:
  - guides/kubernetes-on-aws
  - guides/orderflow-aws
  - examples/cli-snippets
  - posts/eks-ecr-best-practices
---

> Build and operate a production-style microservices application on Amazon EKS — VPC, persistence, ingress, autoscaling, observability, GitOps, and secrets.

## Final architecture

```mermaid
graph TD
    Internet[Internet] --> ALB[Application Load Balancer]
    ALB -->|"/"| Frontend[Frontend Nginx]
    ALB -->|"/api/*"| Backend[Flask Backend]
    ALB -->|"/grafana"| Grafana[Grafana]
    Backend --> DB[PostgreSQL]
    DB --> EBS[(EBS Volume)]
    Grafana --> Prometheus[Prometheus]
    Prometheus --> Metrics[Cluster Metrics]
```

## Phases

| Phase | Topic |
|-------|-------|
| 01 | [Infrastructure Setup]({{< relref "01-infrastructure-setup" >}}) — VPC, subnets, NAT |
| 02 | [EKS Cluster Creation]({{< relref "02-eks-cluster" >}}) — control plane and node group |
| 03 | [EBS CSI Driver]({{< relref "03-ebs-csi-driver" >}}) — persistent volume support |
| 04 | [PostgreSQL Persistence]({{< relref "04-postgresql-persistence" >}}) — StatefulSet and storage |
| 05 | [Application Deployment]({{< relref "05-application-deployment" >}}) — backend and frontend images |
| 06 | [ConfigMaps and Secrets]({{< relref "06-configmaps-secrets" >}}) — configuration management |
| 07 | [Backend Database Integration]({{< relref "07-backend-database-integration" >}}) — Flask API and PostgreSQL |
| 08 | [AWS Load Balancer Controller]({{< relref "08-aws-load-balancer-controller" >}}) — ALB ingress controller |
| 09 | [Ingress Configuration]({{< relref "09-ingress-configuration" >}}) — path-based routing |
| 10 | [Frontend Application]({{< relref "10-frontend-application" >}}) — Nginx UI |
| 11 | [Metrics Server]({{< relref "11-metrics-server" >}}) — resource metrics |
| 12 | [Horizontal Pod Autoscaler]({{< relref "12-horizontal-pod-autoscaler" >}}) — pod autoscaling |
| 13 | [Prometheus and Grafana]({{< relref "13-prometheus-grafana" >}}) — monitoring stack |
| 14 | [Grafana Access and Dashboards]({{< relref "14-grafana-access-dashboards" >}}) — dashboards and access |
| 15 | [Application Metrics]({{< relref "15-application-metrics" >}}) — custom app metrics |
| 16 | [Advanced Autoscaling with Karpenter]({{< relref "16-advanced-autoscaling-karpenter" >}}) — node provisioning |
| 17 | [GitOps Deployment with ArgoCD]({{< relref "17-gitops-argocd" >}}) — declarative deploys |
| 18 | [DNS and TLS Automation]({{< relref "18-dns-tls-automation" >}}) — Route 53 and ACM |
| 19 | [Security and Secrets]({{< relref "19-security-secrets" >}}) — Secrets Manager integration |

**See also:** [Kubernetes on AWS]({{< relref "guides/kubernetes-on-aws" >}}) · [CLI snippets]({{< relref "examples/cli-snippets" >}}) · [Backend app example]({{< relref "examples/shopsphere-backend-app" >}})
