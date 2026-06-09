---
title: "Security and Secrets"
description: "ShopSphere EKS walkthrough — Security and Secrets."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - shopsphere
  - eks
  - secrets-manager
  - security
  - walkthrough
  - code-sample
series:
  - shopsphere-eks
weight: 190
related:
  - guides/shopsphere-eks
  - guides/kubernetes-on-aws
---

## Objective

Eliminate base64-encoded Kubernetes Secrets from Git by integrating the Secrets Store CSI Driver with AWS Secrets Manager, mounting secrets directly as volumes in pods.

## Architecture

```
AWS Secrets Manager (Source of Truth for Secrets)
  ↓ (API Call)
Secrets Store CSI Driver (Runs on Node)
  ↓ (Mounts as in-memory tmpfs volume)
Pod (/mnt/secrets/db-password)
```

## Commands

### Install Secrets Store CSI Driver & AWS Provider

```bash
helm repo add secrets-store-csi-driver <https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts>
helm install csi-secrets-store secrets-store-csi-driver/secrets-store-csi-driver \
  --namespace kube-system

# Install AWS Provider
helm repo add aws-secrets-provider <https://aws.github.io/secrets-store-csi-driver-provider-aws>
helm install secrets-provider-aws aws-secrets-provider/aws-secrets-provider \
  --namespace kube-system
```

### Create IAM Role for Pod

```bash
eksctl create iamserviceaccount \
  --name backend-sa \
  --namespace shopsphere \
  --cluster shopsphere \
  --attach-policy-arn arn:aws:iam::123456789012:policy/SecretsManagerReadPolicy \
  --approve
```

## Manifests

### SecretProviderClass

```yaml
# shopsphere/secret-provider-class.yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: backend-aws-secrets
  namespace: shopsphere
spec:
  provider: aws
  parameters:
    objects: |
      - objectName: "shopsphere/prod/db-password" # ARN or name in AWS Secrets Manager
        objectType: "secretsmanager"
        jmesPath:
            - path: password
              objectAlias: db_password
  secretObjects:
  - data:
    - key: db_password
      objectName: db_password
    secretName: db-secret-synced # Optional: syncs to a K8s secret for env vars
    type: Opaque
```

### Updated Backend Deployment

```yaml
# shopsphere/backend-deployment.yaml (Snippet)
spec:
  template:
    spec:
      serviceAccountName: backend-sa # Must use the IRSA service account
      containers:
      - name: backend
        image: shopsphere-backend:latest
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret-synced
              key: db_password
        volumeMounts:
        - name: secrets-store
          mountPath: "/mnt/secrets"
          readOnly: true
      volumes:
      - name: secrets-store
        csi:
          driver: secrets-store.csi.k8s.io
          readOnly: true
          volumeAttributes:
            secretProviderClass: "backend-aws-secrets"
```

## Verification

```bash
# 1. Exec into the backend pod
kubectl exec -it -n shopsphere deployment/backend -- bash

# 2. Verify the secret is mounted as a file
cat /mnt/secrets/db_password
# Expected: The actual plain-text password from AWS Secrets Manager

# 3. Verify the environment variable is populated
echo $DB_PASSWORD
```

## Screenshots

> 

## Troubleshooting

### Issue: Pod stuck in ContainerCreating / MountVolume.SetUp failed

**Cause:** The Service Account lacks the IAM permissions to read the specific secret in AWS Secrets Manager, or the CSI driver isn't running on the node.
**Fix:** Verify the IRSA role trust policy and the attached IAM policy allows `secretsmanager:GetSecretValue`. Check `kubectl describe pod` for the exact CSI error.

## Lessons learned

✅ **Secrets Store CSI Driver is the industry standard.** It prevents secrets from being stored in etcd (if you don't use the `secretObjects` sync feature) and keeps them out of Git.

✅ **Rotation is automatic.** If you update the secret in AWS Secrets Manager, the CSI driver will automatically update the mounted file in the pod (though the app may need to be configured to reload the file).

---

## Project completion

You have successfully built, deployed, and operated a production-grade, fully automated, and highly observable microservices architecture on Amazon EKS!

### Final architecture checklist

```
✅ Infrastructure: VPC, Public/Private Subnets, NAT Gateways
✅ Compute: EKS Cluster, Managed Node Groups, Karpenter Node Autoscaling
✅ Storage: EBS CSI Driver, gp3 Persistent Volumes for PostgreSQL
✅ Application: Flask Backend, Nginx Frontend, Path-based ALB Ingress
✅ Scaling: Horizontal Pod Autoscaler (CPU-based)
✅ Observability: Prometheus, Grafana, Custom App Metrics (ServiceMonitors)
✅ GitOps: ArgoCD for automated deployment and self-healing
✅ Networking & Security: ExternalDNS, Let's Encrypt TLS, AWS Secrets Manager via CSI
```

### What's next

You now have a robust platform. To continue your DevOps journey, consider exploring:

1. **Service Mesh:** Install **Istio** or **Linkerd** for mTLS, traffic splitting (Canary deployments), and advanced observability.
2. **Policy as Code:** Implement **Kyverno** or **OPA Gatekeeper** to enforce security policies (e.g., "no root containers", "must have resource limits").
3. **Chaos Engineering:** Use **Litmus** or **Chaos Mesh** to intentionally kill pods or inject network latency to test the resilience of your HPA and Karpenter configurations.
4. **CI/CD Pipelines:** Build GitHub Actions or GitLab CI pipelines to automatically run tests, build Docker images, push to ECR, and update the GitOps repository.


---
← [Previous: DNS and TLS Automation]({{< relref "18-dns-tls-automation" >}})
