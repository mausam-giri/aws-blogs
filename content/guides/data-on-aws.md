---
title: "Data on AWS"
description: "RDS operations, Redshift COPY, and Athena queries for analytics and forensics."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
weight: 40
tags:
  - rds
  - redshift
  - athena
  - s3
  - databases
  - analytics
  - checklist
related:
  - guides/orderflow-aws
  - examples/lambda-event-pipeline
  - examples/aws-reference-links
---

## Overview

Operational checklists for RDS, Redshift data loading, and Athena forensics queries.

## Amazon RDS

RDS operational checklist for connectivity, backups, SSL, and performance triage.

### Connectivity checklist

- Publicly accessible is not enough — verify subnet routes, security groups, and NACL return traffic.
- Prefer private subnets and inbound rules from the application security group.
- Confirm SSL requirements and engine-specific parameters such as `rds.force_ssl` when used.

### Operations checklist

- Set backup retention, deletion protection, and final snapshot behavior deliberately.
- Track parameter group changes that enter `pending-reboot`.
- Enable CloudWatch metrics plus Database Insights or Performance Insights depending on support needs.

### MySQL client export

```bash
mysql -h <endpoint> -P 3306 -u <user> -p --ssl-ca=global-bundle.pem <db> \
  -e "SELECT * FROM products" > products.csv
```

### References

- [RDS Performance Insights](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PerfInsights.html)
- [Connecting to an RDS DB instance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.Connect.html)

## Redshift COPY from S3

Redshift COPY runbook for loading S3 data with IAM roles and validation.

### Recommended pattern

```sql
COPY target_table
FROM 's3://bucket/prefix/'
IAM_ROLE 'arn:aws:iam::<account-id>:role/<redshift-copy-role>'
FORMAT AS JSON 'auto'
REGION '<bucket-region>';
```

### Checklist

- Prefer `IAM_ROLE` over long-lived access keys.
- Grant `s3:GetObject` and `s3:ListBucket` as needed; include KMS permissions for SSE-KMS data.
- Use manifest files for controlled loads and staging tables for validation.
- Specify `REGION` when the S3 bucket is not in the same Region as the Redshift cluster.

### References

- [Redshift COPY command](https://docs.aws.amazon.com/redshift/latest/dg/r_COPY.html)
- [COPY from Amazon S3](https://docs.aws.amazon.com/redshift/latest/dg/copy-parameters-data-source-s3.html)
- [COPY credentials and permissions](https://docs.aws.amazon.com/redshift/latest/dg/loading-data-access-permissions.html)

## Athena and forensics

VPC Flow Logs and CloudTrail analysis patterns. Full query samples: [OrderFlow snippets]({{< relref "examples/orderflow-snippets" >}}).

### VPC Flow Logs external table

```sql
CREATE EXTERNAL TABLE IF NOT EXISTS vpc_flow_logs (
  version int, account_id string, interface_id string,
  srcaddr string, dstaddr string, srcport int, dstport int,
  protocol bigint, packets bigint, bytes bigint,
  start bigint, `end` bigint, action string, log_status string
)
PARTITIONED BY (`date` date)
ROW FORMAT DELIMITED FIELDS TERMINATED BY ' '
LOCATION 's3://DOC-EXAMPLE-BUCKET/AWSLogs/{account_id}/vpcflowlogs/{region_code}/'
TBLPROPERTIES ("skip.header.line.count"="1");
```

**See also:** [OrderFlow guide]({{< relref "guides/orderflow-aws" >}}) · [Lambda pipeline example]({{< relref "examples/lambda-event-pipeline" >}})
