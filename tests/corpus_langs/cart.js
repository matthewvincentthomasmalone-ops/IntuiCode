// A shopping basket that remembers its contents in the browser.
const STORAGE_KEY = 'basket.v1';
const TAX_RATE = 0.2;

function loadBasket() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveBasket(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function addItem(items, product, quantity = 1) {
  const existing = items.find(i => i.id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ id: product.id, name: product.name, price: product.price, quantity });
  }
  saveBasket(items);
  return items;
}

function totals(items) {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.price * item.quantity;
  }
  const tax = subtotal * TAX_RATE;
  return { subtotal, tax, total: subtotal + tax };
}

function render(items) {
  const list = document.getElementById('basket');
  list.textContent = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = `${item.name} x ${item.quantity}`;
    list.appendChild(li);
  }
  const t = totals(items);
  document.getElementById('total').textContent = t.total.toFixed(2);
}

document.getElementById('add').addEventListener('click', () => {
  const basket = addItem(loadBasket(), { id: 7, name: 'Tea', price: 3.5 });
  render(basket);
});

render(loadBasket());
