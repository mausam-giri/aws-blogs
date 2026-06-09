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

AWS CloudOps / DevOps notebook for runbooks, failure modes, labs, and verified service references.

## Guides

- [ShopSphere on Amazon EKS]({{< relref "guides/shopsphere-eks" >}}) — full EKS microservices walkthrough
- [OrderFlow on AWS]({{< relref "guides/orderflow-aws" >}}) — 15-phase managed services migration
- [Kubernetes on AWS]({{< relref "guides/kubernetes-on-aws" >}})
- [Networking on AWS]({{< relref "guides/networking-on-aws" >}})
- [Data on AWS]({{< relref "guides/data-on-aws" >}})
- [Serverless on AWS]({{< relref "guides/serverless-on-aws" >}}) — 11-phase SAM and Lambda walkthrough

## Posts

- [What is vCPU?]({{< relref "posts/what-is-vcpu" >}})
- [AWS Lambda CI/CD]({{< relref "posts/aws-lambda-cicd" >}})
- [EKS ECR Best Practices]({{< relref "posts/eks-ecr-best-practices" >}})
- [Kinesis Streams and Analytics]({{< relref "posts/kinesis-streams-and-analytics" >}})

## Examples

- [AWS JSON Policy Tool]({{< relref "examples/aws-json-tool" >}})
- [IAM Policy Examples]({{< relref "examples/iam-policies" >}})
- [Lambda Event Pipeline]({{< relref "examples/lambda-event-pipeline" >}})
- [CLI and Code Snippets]({{< relref "examples/cli-snippets" >}})
- [AWS Reference Links]({{< relref "examples/aws-reference-links" >}})

## Browse by Tag

Popular tags: [#eks](/tags/eks/) · [#iam](/tags/iam/) · [#vpc](/tags/vpc/) · [#lambda](/tags/lambda/) · [#networking](/tags/networking/) · [#rds](/tags/rds/) · [#kubernetes](/tags/kubernetes/) · [#serverless](/tags/serverless/)

## Global Guardrails

- For unexpected AccessDenied, check SCPs, permissions boundaries, session policies, resource policies, and KMS key policies.
- For private workloads, validate VPC DNS settings, route tables, endpoint security groups, NACL return traffic, and egress TCP 443.
- Define teardown for NAT gateways, endpoints, RDS snapshots, load balancers, and log retention before labs.
