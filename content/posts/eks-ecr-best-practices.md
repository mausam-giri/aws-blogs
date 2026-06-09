---
title: "EKS ECR Best Practices"
description: "Harden ECR repositories with scanning, tag mutability, and lifecycle policies."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
weight: 30
tags:
  - eks
  - ecr
  - containers
  - security
  - kubernetes
  - image-scanning
related:
  - guides/kubernetes-on-aws
  - guides/shopsphere-eks
---

## Overview

Harden Amazon ECR repositories used by EKS workloads with scanning, immutable tags for production, and lifecycle rules that control storage cost.

## Repository settings

- **Scan on push:** `true` — catch CVEs before images reach the cluster
- **Tags:** `Environment=Prod`, `ManagedBy=Manual` (or your standard tag set)
- **Tag mutability:** `Immutable` for production repos; `Mutable` only for dev/test if needed

## Lifecycle policy

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Cleanup untagged images after 7 days",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 7
      },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 2,
      "description": "Expire dev/test branch builds after 14 days",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["test-", "dev-", "feature-"],
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 14
      },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 3,
      "description": "Keep only last 20 production release tags",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["prod-", "v"],
        "countType": "imageCountMoreThan",
        "countNumber": 20
      },
      "action": { "type": "expire" }
    }
  ]
}
```

**See also:** [Kubernetes on AWS]({{< relref "guides/kubernetes-on-aws" >}}) · [ShopSphere walkthrough]({{< relref "guides/shopsphere-eks" >}})
