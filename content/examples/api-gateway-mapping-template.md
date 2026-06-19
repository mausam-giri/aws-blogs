---
title: "API Gateway Mapping Template"
description: "VTL mapping templates for DynamoDB integration with API Gateway."
date: 2026-06-19
lastmod: 2026-06-19
draft: false
type: example
weight: 32
tags:
  - api-gateway
  - dynamodb
  - mapping-template
  - vtl
  - aws
  - code-sample
related:
  - examples/iam-policies
  - examples/cli-snippets
---

### DynamoDB

https://aws.amazon.com/blogs/compute/using-amazon-api-gateway-as-a-proxy-for-dynamodb/

Table: 

```json
Users
```

Request body:

```json
{
  "userId":"u123",
  "name":"Mausam",
  "age":24
}
```

#### Integration Request Mapping Template

Content-Type:

```objectivec
application/json
```

VTL:

```json
{
    "TableName": "Users",
    "Item": {
        "userId": {
            "S": "$input.path('$.userId')"
        },
        "name": {
            "S": "$input.path('$.name')"
        },
        "age": {
            "N": "$input.path('$.age')"
        }
    }
}
```

### Integration Response

DynamoDB `PutItem` returns:

```
{}
```

Usually we return custom JSON:

```
{
  "message": "User created successfully"
}
```

#### Path: GET Item

```
GET /users/{id}
```

Example:

```
GET /users/u123
```

---

#### Integration Request Mapping Template

VTL:

```json
{
    "TableName": "Users",
    "Key": {
        "userId": {
            "S": "$input.params('id')"
        }
    }
}
```

---

#### DynamoDB Response

DynamoDB returns:

```json
{
  "Item": {
    "userId": {
      "S":"u123"
    },
    "name": {
      "S":"Mausam"
    },
    "age": {
      "N":"24"
    }
  }
}
```

---

#### Integration Response Mapping Template

VTL:

```json
{
    "userId": "$input.path('$.Item.userId.S')",
    "name": "$input.path('$.Item.name.S')",
    "age": $input.path('$.Item.age.N')
}
```

Client receives:

```json
{
  "userId":"u123",
  "name":"Mausam",
  "age":24
}
```

#### SCAN

```
GET /users
```

Integration Request:

```
{
    "TableName": "Users"
}
```

Response Template:

```
#set($items = [])

#foreach($item in $input.path('$.Items'))
    #set($dummy = $items.add({
        "userId": $item.userId.S,
        "name": $item.name.S,
        "age": $item.age.N
    }))
#end

$util.toJson($items)
```

Response:

```
[
  {
    "userId":"u123",
    "name":"Mausam",
    "age":24
  }
]
```

For direct API Gateway → DynamoDB integration:

```yaml
Integration Type : AWS Service
AWS Service      : DynamoDB
Action           : PutItem / GetItem
Execution Role   : API Gateway IAM Role
```

IAM policy:

```json
{
  "Effect":"Allow",
  "Action": [
"dynamodb:PutItem",
"dynamodb:GetItem"
  ],
  "Resource":"arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/Users"
}
```

### Step Function Calling

Integration Request

```yaml
{
  "stateMachineArn":"arn:aws:states:REGION:ACCOUNT_ID:stateMachine:STATE_MACHINE_ARN",
  "input":"$util.escapeJavaScript($input.body)"
}
```

**Formatted JSON Response**: Integration Response

```kotlin
#set($output = $util.parseJson($input.path('$.output')))

$output
```