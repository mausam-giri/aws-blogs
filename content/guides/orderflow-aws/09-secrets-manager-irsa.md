---
title: "Secrets Manager and IRSA"
description: "OrderFlow walkthrough — OrderFlowApiRole and runtime credential fetch."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - irsa
  - secrets-manager
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 90
related:
  - guides/orderflow-aws
  - examples/iam-policies
  - guides/kubernetes-on-aws
---

## Objective

Grant the API pods permission to read the **RDS master secret** from Secrets Manager using **IRSA** — no long-lived AWS keys or Kubernetes secret objects in Git.

## Architecture

```
orderflow-api pod
  → service account orderflow-api (IRSA)
  → OrderFlowApiRole
  → secretsmanager:GetSecretValue (RDS secret only)
  → psycopg2/SQLAlchemy connection to RDS
```

## Commands

### Create least-privilege policy

```bash
export SECRET_ARN=$(aws rds describe-db-instances \
  --db-instance-identifier orderflow-db \
  --query 'DBInstances[0].MasterUserSecret.SecretArn' --output text)

cat > orderflow-api-secrets-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
    "Resource": "$SECRET_ARN"
  }]
}
EOF

aws iam create-policy \
  --policy-name OrderFlowApiSecretsPolicy \
  --policy-document file://orderflow-api-secrets-policy.json
```

### Create IRSA service account

```bash
eksctl create iamserviceaccount \
  --cluster orderflow-cluster \
  --namespace orderflow \
  --name orderflow-api \
  --role-name OrderFlowApiRole \
  --attach-policy-arn arn:aws:iam::ACCOUNT_ID:policy/OrderFlowApiSecretsPolicy \
  --approve
```

### Roll API to pick up service account

```bash
kubectl rollout restart deployment/orderflow-api -n orderflow
kubectl describe pod -n orderflow -l app=orderflow-api | grep -E 'AWS_ROLE_ARN|AWS_WEB_IDENTITY'
```

## Manifests

### API secret-fetch pattern (application code)

```python
import boto3
import json
import os

def get_db_credentials():
    client = boto3.client("secretsmanager", region_name=os.environ["AWS_REGION"])
    resp = client.get_secret_value(SecretId=os.environ["DB_SECRET_ARN"])
    secret = json.loads(resp["SecretString"])
    return secret["username"], secret["password"]
```

### ConfigMap (non-secret only)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: orderflow-api-config
  namespace: orderflow
data:
  DB_HOST: "orderflow-db.xxxx.us-east-1.rds.amazonaws.com"
  DB_PORT: "5432"
  DB_NAME: "orderflowdb"
  DB_SECRET_ARN: "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:rds!..."
  AWS_REGION: "us-east-1"
```

## Verification

```bash
kubectl exec -it deployment/orderflow-api -n orderflow -- env | grep AWS_
# Expected: AWS_ROLE_ARN, AWS_WEB_IDENTITY_TOKEN_FILE

kubectl exec -it deployment/orderflow-api -n orderflow -- \
  python -c "import boto3; print(boto3.client('sts').get_caller-identity())"
# Expected: Arn contains OrderFlowApiRole
```

## Troubleshooting

### AccessDenied on GetSecretValue

- Policy `Resource` must match the exact secret ARN.
- Pod must use `serviceAccountName: orderflow-api`, not `default`.
- Confirm OIDC provider exists (Phase 02).

### No AWS_ROLE_ARN on pod

Deployment spec missing `serviceAccountName` or service account created in wrong namespace.

## Lessons learned

- Split **connection metadata** (ConfigMap) from **credentials** (Secrets Manager).
- Scope IAM to a single secret ARN — avoid `secretsmanager:*` on `*`.

---
← [Previous: RDS PostgreSQL]({{< relref "08-rds-postgresql" >}})  [Next: API and Database Integration]({{< relref "10-api-database-integration" >}}) →
