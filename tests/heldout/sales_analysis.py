import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("sales.csv", parse_dates=["date"])
df["month"] = df["date"].dt.to_period("M")
monthly = df.groupby("month")["amount"].sum()
best_month = monthly.idxmax()
print(f"Best month: {best_month} with {monthly.max():,.2f}")

top_products = (
    df.groupby("product")["amount"]
    .sum()
    .sort_values(ascending=False)
    .head(5)
)
for product, total in top_products.items():
    print(product, round(total, 2))

monthly.plot(kind="bar", title="Sales by month")
plt.tight_layout()
plt.savefig("sales.png")
