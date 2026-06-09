---
title: "HTTP API Gateway"
description: "Serverless walkthrough — HTTP API routes, CORS, and Lambda proxy integration."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - apigateway
  - lambda
  - serverless
  - walkthrough
  - code-sample
series:
  - serverless-on-aws
weight: 30
related:
  - guides/serverless-on-aws
  - examples/serverless-snippets
---

## Objective

Expose the producer Lambda through an **HTTP API** (API Gateway v2) with `POST /orders`, explicit CORS, and automatic Lambda proxy integration via SAM events.

## Architecture

```
Client POST /orders
  → HTTP API (v2)
  → Lambda proxy integration
  → ProducerFunction
```

## Commands

```bash
sam local start-api
curl -s -X POST http://127.0.0.1:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-101","amount":250}'
```

## Manifests

```yaml
ProducerFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: app.lambda_handler
    CodeUri: src/producer/
    Events:
      CreateOrder:
        Type: HttpApi
        Properties:
          ApiId: !Ref OrderHttpApi
          Path: /orders
          Method: POST

OrderHttpApi:
  Type: AWS::Serverless::HttpApi
  Properties:
    StageName: $default
    CorsConfiguration:
      AllowOrigins: ["https://app.example.com"]
      AllowMethods: [GET, POST, OPTIONS]
      AllowHeaders: [Content-Type, Authorization]
      MaxAge: 300

Outputs:
  ApiEndpoint:
    Value: !Sub "https://${OrderHttpApi}.execute-api.${AWS::Region}.amazonaws.com"
```

## Verification

```bash
# Local
sam local start-api
curl -i -X POST http://127.0.0.1:3000/orders -d '{"userId":"u1","amount":99}'

# Deployed
curl -i -X POST "$API_ENDPOINT/orders" -H "Content-Type: application/json" \
  -d '{"userId":"u1","amount":99}'
```

## Troubleshooting

### CORS preflight fails

Ensure `OPTIONS` is in `AllowMethods` and the stage CORS config matches the browser origin exactly (no trailing slash mismatch).

### 403 from API Gateway

Check Lambda resource policy created by SAM and that the route `Method`/`Path` match the client request.

## Lessons learned

- Prefer **HTTP API** over REST API for Lambda-backed JSON services — lower cost and simpler model.
- Restrict `AllowOrigins` in production; use `*` only in dev stages.

---
← [Previous: Lambda Functions]({{< relref "02-lambda-functions" >}})  [Next: EventBridge]({{< relref "04-eventbridge" >}}) →
