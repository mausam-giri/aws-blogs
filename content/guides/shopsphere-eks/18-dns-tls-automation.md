---
title: "DNS and TLS Automation"
description: "ShopSphere EKS walkthrough — DNS and TLS Automation."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - dns
  - tls
  - cert-manager
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 180
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Automate DNS record creation using ExternalDNS and provision free SSL/TLS certificates using cert-manager with Let's Encrypt.

## Architecture

```
ExternalDNS: Watches Ingress → Updates Route53 A/CNAME records
cert-manager: Watches Ingress annotations → Solves ACME challenge → Creates K8s TLS Secret
```

## Commands

### Install ExternalDNS

```bash
# Create IAM Role for ExternalDNS (Route53 permissions)
eksctl create iamserviceaccount \
  --name external-dns \
  --namespace external-dns \
  --cluster shopsphere \
  --attach-policy-arn arn:aws:iam::123456789012:policy/ExternalDNSPolicy \
  --approve

helm repo add external-dns <https://kubernetes-sigs.github.io/external-dns/>
helm install external-dns external-dns/external-dns \
  --namespace external-dns --create-namespace \
  --set provider=aws \
  --set policy=sync \
  --set txtOwnerId=shopsphere \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=arn:aws:iam::123456789012:role/ExternalDNSRole
```

### Install cert-manager

```bash
helm repo add jetstack <https://charts.jetstack.io>
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

## Manifests

### Let's Encrypt ClusterIssuer

```yaml
# monitoring/cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: <https://acme-v02.api.letsencrypt.org/directory>
    email: admin@shopsphere.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: alb
```

### Updated Ingress with TLS

```yaml
# ingress.yaml (Updated)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shopsphere-ingress
  namespace: shopsphere
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    cert-manager.io/cluster-issuer: "letsencrypt-prod" # Triggers cert-manager
spec:
  tls:
  - hosts:
    - shopsphere.yourdomain.com
    secretName: shopsphere-tls # cert-manager will create this secret
  rules:
  - host: shopsphere.yourdomain.com
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

## Verification

```bash
# Check Certificate status
kubectl get certificates -n shopsphere
# Expected: READY = True

# Check DNS record
dig shopsphere.yourdomain.com +short
# Expected: Returns the ALB DNS name

# Test HTTPS
curl -I <https://shopsphere.yourdomain.com>
# Expected: HTTP/2 200, valid Let's Encrypt certificate
```

## Troubleshooting

### Issue: Certificate stays in "Ready: False"

**Cause:** The HTTP01 challenge fails because the ALB isn't routing the `.well-known/acme-challenge` path correctly, or ExternalDNS hasn't propagated the DNS record yet.
**Fix:** Check `kubectl describe certificate shopsphere-tls`. Ensure DNS has propagated (can take up to 5 mins).

## Lessons learned

✅ **DNS propagation takes time.** Let's Encrypt cannot validate your domain if the DNS record isn't fully propagated globally.

✅ **AWS ACM vs Let's Encrypt.** For AWS ALBs, using AWS Certificate Manager (ACM) via the `alb.ingress.kubernetes.io/certificate-arn` annotation is often simpler and avoids HTTP01 routing complexities. Use Let's Encrypt for multi-cloud or non-ALB setups.

---


---
← [Previous: GitOps Deployment with ArgoCD]({{< relref "17-gitops-argocd" >}})  [Next: Security and Secrets]({{< relref "19-security-secrets" >}}) →
