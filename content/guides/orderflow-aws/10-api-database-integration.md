---
title: "API and Database Integration"
description: "OrderFlow walkthrough — orders schema, REST endpoints, and RDS connectivity."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
type: guide
tags:
  - orderflow
  - rds
  - api
  - walkthrough
  - code-sample
series:
  - orderflow-aws
weight: 100
related:
  - guides/orderflow-aws
  - examples/shopsphere-backend-app
---

## Objective

Wire the Flask API to RDS: create the **orders** table, expose **GET/POST /orders**, and confirm end-to-end persistence through the ALB.

## Architecture

```
POST /orders
  → validate payload
  → INSERT into orders (RDS)
  → return 201 + order_id
  (SQS enqueue added in Phase 11)
```

## Commands

### Apply ConfigMap and restart API

```bash
kubectl apply -f k8s/api-configmap.yaml
kubectl rollout restart deployment/orderflow-api -n orderflow
```

### Smoke test via ALB

```bash
export ALB=$(kubectl get ingress orderflow-ingress -n orderflow \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

curl -s "http://${ALB}/health"
curl -s "http://${ALB}/orders"
curl -s -X POST "http://${ALB}/orders" \
  -H "Content-Type: application/json" \
  -d '{"order_id":"ord-001","status":"CREATED"}'
curl -s "http://${ALB}/orders"
```

### Verify row in RDS

```bash
kubectl run postgres-client -n orderflow --image=postgres:17 --restart=Never -- sleep infinity
kubectl exec -it postgres-client -n orderflow -- \
  psql -h $DB_HOST -U orderflow -d orderflowdb -c "SELECT * FROM orders;"
kubectl delete pod postgres-client -n orderflow
```

## Manifests

### Schema (run once at app startup or migration job)

```sql
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Flask route sketch

```python
@app.route("/orders", methods=["GET"])
def list_orders():
    rows = db.session.execute(text("SELECT order_id, status, created_at FROM orders ORDER BY id DESC LIMIT 50"))
    return jsonify([dict(r._mapping) for r in rows])

@app.route("/orders", methods=["POST"])
def create_order():
    data = request.get_json(force=True)
    db.session.execute(
        text("INSERT INTO orders (order_id, status) VALUES (:oid, :st)"),
        {"oid": data["order_id"], "st": data.get("status", "CREATED")},
    )
    db.session.commit()
    return jsonify(data), 201
```

## Verification

| Check | Expected |
|-------|----------|
| `GET /health` | HTTP 200 |
| `GET /orders` | `[]` or list of orders |
| `POST /orders` | HTTP 201, row in RDS |
| API logs | No `password authentication failed` |

```bash
kubectl logs deployment/orderflow-api -n orderflow --tail=30
```

## Troubleshooting

### SSL required by RDS

Add `?sslmode=require` to the SQLAlchemy URL or set `sslmode` in the Postgres driver options.

### Unique violation on order_id

Expected if re-posting the same `order_id` — return HTTP 409 in production.

## Lessons learned

- Run schema migration **before** exposing POST publicly.
- Test through the **ALB** hostname, not only port-forward — validates SG paths end-to-end.

---
← [Previous: Secrets Manager and IRSA]({{< relref "09-secrets-manager-irsa" >}})  [Next: SQS Queue Integration]({{< relref "11-sqs-integration" >}}) →
