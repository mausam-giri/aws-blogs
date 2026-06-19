---
title: "ShopSphere Ingress Variants"
description: "ALB Ingress manifests for ShopSphere — basic, multi-host, auth, and Grafana routing."
date: 2026-06-09
lastmod: 2026-06-19
draft: false
weight: 36
type: example
tags:
  - shopsphere
  - ingress
  - alb
  - kubernetes
  - code-sample
related:
  - guides/shopsphere-eks/09-ingress-configuration
  - guides/shopsphere-eks/08-aws-load-balancer-controller
---

## Purpose

Alternate ingress manifests referenced from [Ingress Configuration]({{< relref "guides/shopsphere-eks/09-ingress-configuration" >}}). The phase guide keeps the canonical basic ingress only.

## Basic ingress (path-based)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shopsphere-ingress
  namespace: shopsphere
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}]'
    alb.ingress.kubernetes.io/healthcheck-path: /api/health
spec:
  rules:
  - http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 5000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

``` yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: custom-ingress
  namespace: custom-app
  annotations:
    alb.ingress.kubernetes.io/load-balancer-name: custom-alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip

spec:
  ingressClassName: alb

  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: custom-svc
            port:
              number: 8080
```

## Multi-host ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shopsphere-ingress
  namespace: shopsphere
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:123456789012:certificate/xxxxx
    alb.ingress.kubernetes.io/group.name: shopsphere
spec:
  rules:
  - host: api.shopsphere.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 5000
  - host: shopsphere.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

## Ingress with Cognito auth (annotations)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shopsphere-ingress
  namespace: shopsphere
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    # alb.ingress.kubernetes.io/auth-type: cognito
    # alb.ingress.kubernetes.io/auth-idp-cognito: '{"UserPoolArn":"arn:aws:cognito-idp:...","UserPoolClientId":"xxxx","UserPoolDomain":"auth.example.com"}'
spec:
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

## Grafana ingress (separate path)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana-ingress
  namespace: monitoring
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/group.name: shopsphere
    alb.ingress.kubernetes.io/group.order: '2'
spec:
  rules:
  - http:
      paths:
      - path: /grafana
        pathType: Prefix
        backend:
          service:
            name: monitoring-grafana
            port:
              number: 80
```
