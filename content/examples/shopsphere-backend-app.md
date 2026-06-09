---
title: "ShopSphere Backend Application"
description: "Flask API, Dockerfile, and database init SQL for the ShopSphere EKS backend."
date: 2026-06-09
lastmod: 2026-06-09
draft: false
weight: 35
type: example
tags:
  - shopsphere
  - flask
  - postgresql
  - docker
  - code-sample
  - eks
related:
  - guides/shopsphere-eks/07-backend-database-integration
  - guides/shopsphere-eks/05-application-deployment
---

## Purpose

Full backend application source referenced from [Backend Database Integration]({{< relref "guides/shopsphere-eks/07-backend-database-integration" >}}).

## Flask application (app.py)

```python
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL',
    'postgresql://postgres:postgres@postgres:5432/shopsphere_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    stock = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price': float(self.price),
            'stock': self.stock,
            'created_at': self.created_at.isoformat(),
        }

with app.app_context():
    db.create_all()

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        db.session.execute('SELECT 1')
        return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 503

@app.route('/api/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify({'products': [p.to_dict() for p in products], 'count': len(products)}), 200

@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.get_json()
    product = Product(
        name=data['name'],
        description=data.get('description', ''),
        price=data['price'],
        stock=data.get('stock', 0),
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
```

## Requirements

```text
Flask==2.3.3
Flask-SQLAlchemy==3.0.5
Flask-CORS==4.0.0
psycopg2-binary==2.9.7
python-dotenv==1.0.0
gunicorn==21.2.0
```

## Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
```

## Database initialization

```sql
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (name, description, price, stock) VALUES
('Laptop', 'High-performance laptop', 999.99, 10),
('Mouse', 'Wireless mouse', 29.99, 50),
('Keyboard', 'Mechanical keyboard', 79.99, 30)
ON CONFLICT DO NOTHING;
```
