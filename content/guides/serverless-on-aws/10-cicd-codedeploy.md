---
title: "CI/CD with CodeDeploy"
description: "Serverless walkthrough — CodePipeline, canary Lambda deployments, rollback."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - cicd
  - codedeploy
  - lambda
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 100
related:
  - guides/serverless-on-aws
  - posts/aws-lambda-cicd
---

## Objective

Automate Lambda releases with **CodePipeline** and **CodeDeploy canary** traffic shifting on the `prod` alias — no instant 100% cutover.

## Architecture

```
Git push
  → CodePipeline
  → CodeBuild (sam build / zip)
  → S3 artifact
  → CodeDeploy → prod alias 10% → 50% → 100%
  → CloudWatch alarms trigger rollback on errors
```

## Commands

```bash
aws deploy create-application \
  --application-name order-serverless \
  --compute-platform Lambda

aws deploy create-deployment-group \
  --application-name order-serverless \
  --deployment-group-name prod \
  --service-role-arn arn:aws:iam::ACCOUNT:role/CodeDeployLambdaRole \
  --deployment-config-name CodeDeployDefault.LambdaCanary10Percent5Minutes
```

### Deployment strategies

| Config | Behavior |
|--------|----------|
| `LambdaAllAtOnce` | 100% immediately |
| `LambdaCanary10Percent5Minutes` | 10% for 5 min, then full |
| `LambdaLinear10PercentEvery1Minute` | Linear 10%/min |

## Manifests

### `appspec.yml`

```yaml
version: 0.0
Resources:
  - MyFunction:
      Type: AWS::Lambda::Function
      Properties:
        Name: order-serverless-ProducerFunction
        Alias: prod
        CurrentVersion: 1
        TargetVersion: 2
```

### SAM with canary (alternative to standalone pipeline)

```yaml
ProducerFunction:
  Type: AWS::Serverless::Function
  Properties:
    AutoPublishAlias: prod
    DeploymentPreference:
      Type: Canary10Percent5Minutes
      Alarms:
        - !Ref AliasErrorAlarm
      Hooks:
        PreTraffic: !Ref PreTrafficHookFunction
```

### BuildSpec (CodeBuild)

```yaml
version: 0.2
phases:
  install:
    runtime-versions:
      python: 3.12
    commands:
      - pip install aws-sam-cli
  build:
    commands:
      - sam build
      - sam package --output-template-file packaged.yaml --resolve-s3
artifacts:
  files:
    - packaged.yaml
    - appspec.yml
```

Full pipeline steps: [AWS Lambda CI/CD post]({{< relref "posts/aws-lambda-cicd" >}}).

## Verification

```bash
aws deploy list-deployments \
  --application-name order-serverless \
  --deployment-group-name prod \
  --max-items 3

aws lambda get-alias \
  --function-name order-serverless-ProducerFunction \
  --name prod
```

Trigger a pipeline run and confirm canary percentage increases in the CodeDeploy console before reaching 100%.

## Troubleshooting

### Deployment stuck at 10%

Pre-traffic hook Lambda failing or CloudWatch alarm in `Alarms` list breaching. Check hook logs and alias error rate metrics.

### Rollback occurred

CodeDeploy reverted `prod` alias to previous version — inspect deployment events and fix failing version before retry.

## Lessons learned

- CodeDeploy deploys to **aliases**, not `$LATEST`.
- Attach **error rate alarms** to canary config for automatic rollback.
- SAM `sam deploy` with `DeploymentPreference` is fastest for SAM-native projects; CodePipeline fits multi-repo org standards.

---
← [Previous: Application Auto Scaling]({{< relref "09-application-auto-scaling" >}})  [Next: Observability and Operations]({{< relref "11-observability-operations" >}}) →
