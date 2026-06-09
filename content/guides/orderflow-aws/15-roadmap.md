---
title: "Roadmap"
description: "OrderFlow walkthrough — planned CloudFront, WAF, CI/CD, and EventBridge work."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - cloudfront
  - waf
  - cicd
  - eventbridge
  - walkthrough
series:
  - orderflow-aws
weight: 150
related:
  - guides/orderflow-aws
  - posts/aws-lambda-cicd
  - examples/lambda-event-pipeline
---

## Objective

Document the next production hardening steps not completed in the core 14 phases: edge delivery, WAF, automated deploys, and domain events via EventBridge.

## Architecture (target state)

```
User
  → CloudFront
  → WAF
  → Frontend ALB
  → orderflow-frontend

API ALB → orderflow-api (existing)

Worker → EventBridge (planned)
  → Rules → Lambda / SNS / audit targets
```

## CloudFront and WAF

| Component | Attachment | Purpose |
|-----------|------------|---------|
| CloudFront | Origin: frontend ALB | HTTPS, edge caching, global latency |
| WAF Web ACL | CloudFront distribution | OWASP managed rules, IP reputation |

**Managed rule groups to enable:**

- `AWSManagedRulesCommonRuleSet`
- `AWSManagedRulesKnownBadInputsRuleSet`
- `AWSManagedRulesAmazonIpReputationList`

## CI/CD pipeline

Target flow:

```
GitHub push
  → GitHub Actions (build + test)
  → docker push → ECR (tag = git SHA)
  → kubectl set image / ArgoCD sync
  → EKS rollout (orderflow-api, orderflow-worker)
```

**Tag strategy:** immutable git SHA tags — never promote `latest` to production.

Reference: [AWS Lambda CI/CD]({{< relref "posts/aws-lambda-cicd" >}}) for CodeDeploy patterns; adapt to EKS rollouts with `kubectl rollout status`.

## EventBridge integration

Extend the worker to emit domain events after DynamoDB write:

```json
{
  "Source": "orderflow.worker",
  "DetailType": "OrderProcessed",
  "Detail": "{\"orderId\":\"ord-123\",\"status\":\"PROCESSED\",\"eventId\":\"evt-...\"}"
}
```

```python
events.put_events(
    Entries=[{
        "Source": "orderflow.worker",
        "DetailType": "OrderProcessed",
        "Detail": json.dumps({"orderId": order_id, "status": "PROCESSED"}),
        "EventBusName": "default",
    }]
)
```

Downstream rules can fan out to audit Lambdas, analytics, or cross-account buses — see [Lambda event pipeline]({{< relref "examples/lambda-event-pipeline" >}}).

## Verification checklist (full stack)

- [ ] CloudFront serves frontend with valid ACM certificate
- [ ] WAF blocks common attack probes in count mode, then block mode
- [ ] CI pipeline deploys on merge to `main` with SHA-tagged images
- [ ] EventBridge rule fires on `OrderProcessed` test event

## Lessons learned

- Add **edge and WAF** before exposing customer-facing frontends to the public internet.
- **EventBridge** decouples audit/analytics consumers from the worker loop — keep the worker focused on SQS → SNS → DynamoDB.
- Automate deploys only after Phases 01–14 are stable — CI/CD amplifies misconfiguration speed.

---
← [Previous: CloudWatch Observability]({{< relref "14-cloudwatch-observability" >}})

## Final verification

Complete stack sign-off:

- [ ] `POST /orders` → RDS row + SQS message → worker → SNS + DynamoDB
- [ ] No AWS access keys in Kubernetes Secrets
- [ ] RDS unreachable from public internet
- [ ] ALB + IRSA + private RDS path verified end-to-end

**See also:** [OrderFlow snippets]({{< relref "examples/orderflow-snippets" >}}) · [ShopSphere walkthrough]({{< relref "guides/shopsphere-eks" >}})
