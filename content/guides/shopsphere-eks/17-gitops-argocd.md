---
title: "GitOps Deployment with ArgoCD"
description: "ShopSphere EKS walkthrough — GitOps Deployment with ArgoCD."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - argocd
  - gitops
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 170
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Transition from imperative `kubectl apply` to declarative GitOps using ArgoCD, ensuring the cluster state always matches the manifests stored in a Git repository.

## Architecture

```
Git Repository (Source of Truth)
  ↓ (Polls / Webhooks)
ArgoCD (Continuous Delivery Tool)
  ↓ (Syncs state)
Kubernetes Cluster ( shopsphere namespace )
```

## Commands

### Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f <https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml>

# Expose ArgoCD UI via LoadBalancer
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'

# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```

### Create ArgoCD Application

```bash
kubectl apply -f argocd/application.yaml
```

## Manifests

### ArgoCD Application Manifest

```yaml
# argocd/application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shopsphere
  namespace: argocd
spec:
  project: default
  source:
    repoURL: '<https://github.com/your-username/shopsphere-gitops.git>'
    targetRevision: HEAD
    path: k8s-manifests # Folder in your repo containing the YAMLs
  destination:
    server: '<https://kubernetes.default.svc>'
    namespace: shopsphere
  syncPolicy:
    automated:
      prune: true      # Delete resources not in Git
      selfHeal: true   # Revert manual kubectl changes
    syncOptions:
    - CreateNamespace=true
```

## Verification

1. Access the ArgoCD UI via the LoadBalancer DNS.
2. Log in with `admin` and the decoded password.
3. Verify the `shopsphere` app shows a **Healthy** and **Synced** status (Green).
4. Manually delete a pod using `kubectl delete pod ...` and watch ArgoCD automatically recreate it within seconds (Self-Healing).

## Screenshots

> 

## Lessons learned

✅ **Git is the single source of truth.** Never run `kubectl apply -f` manually in a GitOps environment; commit the change to Git and let ArgoCD sync it.

✅ **Self-Healing is powerful.** ArgoCD will fight against manual changes, which is great for compliance but requires discipline from developers.

---


---
← [Previous: Advanced Autoscaling with Karpenter]({{< relref "16-advanced-autoscaling-karpenter" >}})  [Next: DNS and TLS Automation]({{< relref "18-dns-tls-automation" >}}) →
