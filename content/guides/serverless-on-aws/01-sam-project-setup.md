---
title: "SAM Project Setup"
description: "Serverless walkthrough — sam init, project layout, and template globals."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - sam
  - lambda
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 10
related:
  - guides/serverless-on-aws
  - examples/serverless-snippets
---

## Objective

Initialize an AWS SAM application for the order-events pipeline with a clear directory layout and shared `Globals` for Lambda runtime settings.

## Architecture

```
order-serverless/
├── template.yaml          # SAM/CloudFormation
├── samconfig.toml         # deploy defaults (optional, gitignored if sensitive)
├── src/
│   ├── producer/
│   ├── worker/
│   └── analytics/
├── events/                # sample payloads for local invoke
└── tests/
```

## Commands

```bash
sam init
# Runtime: python3.12
# Template: Hello World with API Gateway
# Name: order-serverless

cd order-serverless
sam validate
```

## Manifests

### Minimal `template.yaml` skeleton

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31
Description: Order events — SAM walkthrough

Globals:
  Function:
    Runtime: python3.12
    Timeout: 30
    MemorySize: 256
    Architectures: [x86_64]
    Tracing: Active
    Environment:
      Variables:
        LOG_LEVEL: INFO

Resources:
  # Functions and event sources added in later phases
```

### `samconfig.toml` (after first guided deploy)

```toml
version = 0.1
[default.deploy.parameters]
stack_name = "order-serverless"
resolve_s3 = true
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
```

## Verification

```bash
sam validate --lint
# Expected: template is valid
```

## Troubleshooting

### `Transform AWS::Serverless-2016-10-31` not found

Install/update [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) and ensure AWS credentials target the intended account/Region.

## Lessons learned

- Set **Globals** once (runtime, timeout, tracing) — override per function only when needed.
- Keep `samconfig.toml` out of git if it contains account-specific S3 buckets; document required deploy flags in README instead.

---
[Next: Lambda Functions]({{< relref "02-lambda-functions" >}}) →
