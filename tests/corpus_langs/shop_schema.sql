-- Tables and reports for a small online shop (PostgreSQL).

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    price NUMERIC(8, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    placed_at TIMESTAMP DEFAULT now()
);

CREATE INDEX orders_by_customer ON orders (customer_id);

INSERT INTO products (title, price, stock) VALUES ('Tea; loose leaf', 4.50, 40);
INSERT INTO products (title, price, stock) VALUES ('Mug', 8.00, 12);
INSERT INTO products (title, price, stock) VALUES ('Biscuits', 2.25, 0);

/* Restock anything that has run out. */
UPDATE products SET stock = 20 WHERE stock = 0;

CREATE OR REPLACE FUNCTION order_total(order_id INTEGER) RETURNS NUMERIC AS $$
BEGIN
    RETURN (SELECT o.quantity * p.price
            FROM orders o JOIN products p ON p.id = o.product_id
            WHERE o.id = order_id);
END;
$$ LANGUAGE plpgsql;

-- Best customers this year
SELECT c.name, COUNT(o.id) AS orders, SUM(o.quantity * p.price) AS spent
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN products p ON p.id = o.product_id
WHERE o.placed_at >= date_trunc('year', now())
GROUP BY c.name
ORDER BY spent DESC
LIMIT 10;

DELETE FROM orders WHERE placed_at < now() - INTERVAL '7 years';

DROP TABLE IF EXISTS old_orders;
