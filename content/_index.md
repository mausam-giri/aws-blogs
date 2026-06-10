---
title: "AWS CloudOps Notes"
description: "Runbooks, walkthroughs, and copy-paste examples for AWS CloudOps and DevOps."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
layout: landing
tags:
  - aws
  - cloudops
  - devops
  - reference-links
---

## Global Guardrails

- For unexpected AccessDenied, check SCPs, permissions boundaries, session policies, resource policies, and KMS key policies.
- For private workloads, validate VPC DNS settings, route tables, endpoint security groups, NACL return traffic, and egress TCP 443.
- Define teardown for NAT gateways, endpoints, RDS snapshots, load balancers, and log retention before labs.
