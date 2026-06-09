---
title: "RDS PostgreSQL"
description: "OrderFlow walkthrough — private RDS orderflow-db and security group rules."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - rds
  - postgresql
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 80
related:
  - guides/orderflow-aws
  - guides/data-on-aws
---

## Objective

Provision **orderflow-db** (PostgreSQL) in private subnets with **no public access**, secured so only EKS nodes can reach port **5432**.

## Architecture

```
orderflow-api pods (private subnets)
  → RDS security group (5432 from node SG)
  → orderflow-db (PostgreSQL, Multi-AZ optional)
  → AWS-managed master secret in Secrets Manager
```

## Commands

### Create DB subnet group and instance

```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name orderflow-db-subnets \
  --db-subnet-group-description "OrderFlow private subnets" \
  --subnet-ids subnet-PRIVATE1 subnet-PRIVATE2

aws rds create-db-instance \
  --db-instance-identifier orderflow-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username orderflow \
  --manage-master-user-password \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-RDS \
  --db-subnet-group-name orderflow-db-subnets \
  --no-publicly-accessible \
  --backup-retention-period 7
```

### Allow nodes to reach RDS

```bash
# Get EKS node security group
NODE_SG=$(aws eks describe-cluster --name orderflow-cluster \
  --query 'cluster.resourcesVpcConfig.clusterSecurityGroupId' --output text)

aws ec2 authorize-security-group-ingress \
  --group-id sg-RDS \
  --protocol tcp \
  --port 5432 \
  --source-group $NODE_SG
```

### Connectivity test from cluster

```bash
kubectl run postgres-client -n orderflow --image=postgres:17 --restart=Never -- sleep infinity

kubectl exec -it postgres-client -n orderflow -- \
  pg_isready -h orderflow-db.xxxx.us-east-1.rds.amazonaws.com -p 5432

kubectl delete pod postgres-client -n orderflow
```

## Manifests

RDS is provisioned via AWS API/Console — no Kubernetes manifests. Record endpoint and port for the ConfigMap in Phase 10:

```
DB_HOST=orderflow-db.xxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=orderflowdb
```

## Verification

```bash
aws rds describe-db-instances --db-instance-identifier orderflow-db \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Public:PubliclyAccessible}'

# Expected: available, PubliclyAccessible=false
```

## Troubleshooting

### Connection timeout from pods

- RDS SG must allow **node security group**, not `0.0.0.0/0`.
- Confirm RDS subnets are the same VPC as the cluster.
- Verify route tables allow node → RDS within VPC (local routes).

### pg_isready fails

Check NACLs and that the client pod runs in the **orderflow** namespace with network policies allowing egress to RDS.

## Lessons learned

- Never enable **publicly accessible** for this pattern.
- Use **manage-master-user-password** so credentials land in Secrets Manager automatically.

---
← [Previous: Ingress Configuration]({{< relref "07-ingress-configuration" >}})  [Next: Secrets Manager and IRSA]({{< relref "09-secrets-manager-irsa" >}}) →
