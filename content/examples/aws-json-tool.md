---
title: "AWS JSON Policy Tool"
description: "Parse, beautify, and lint JSON documents with AWS IAM policy checks."
date: 2026-06-09
lastmod: 2026-06-19
draft: false
type: example
layout: json-tool
weight: 5
bookFlatSection: false
tags:
  - iam
  - json
  - policy-template
  - security
  - code-sample
  - aws
related:
  - examples/iam-policies
  - examples/lambda-event-pipeline
  - guides/kubernetes-on-aws
  - guides/orderflow-aws
---

## How to use

1. Paste JSON into the editor (identity policies, trust policies, bucket policies, or any JSON document).
2. Click **Beautify** to format with consistent indentation.
3. Review linter warnings in the status panel.
4. Copy the formatted output when ready.

## What it checks

- Missing `Version` field
- `Statement` is not an array
- Wildcard `Action` or `Resource` values
- Risky `Principal` values (`*` or overly broad ARNs)

Try a sample from [IAM Policy Examples]({{< relref "iam-policies" >}}) — start with the A1 cross-account trust policy block.

**See also:** [IAM Policy Examples]({{< relref "iam-policies" >}})
