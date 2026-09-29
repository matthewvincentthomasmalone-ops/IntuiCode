import { fetchSales } from "./api.js";

const state = { rows: [], filter: "all" };

class Store {
  constructor(key) {
    this.key = key;
  }
  load() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) ?? [];
    } catch (err) {
      console.warn("bad data", err);
      return [];
    }
  }
}

async function refresh() {
  const { rows } = await fetchSales(state.filter);
  state.rows = rows;
  render();
}

function render() {
  const tbody = document.querySelector("#sales tbody");
  tbody.innerHTML = state.rows.map(r => `<tr><td>${r.month}</td><td>${r.total}</td></tr>`).join("");
  let total = 0;
  for (const r of state.rows) total += r.total;
  switch (state.filter) {
    case "n":
      console.log("north only");
      break;
    default:
      console.log("all regions");
  }
  var legacy = total > 1000 ? "big" : "small";
  document.title = `Sales (${legacy})`;
}

document.getElementById("region").addEventListener("change", (e) => {
  state.filter = e.target.value;
  refresh();
});

let tries = 0;
while (tries < 3) {
  tries += 1;
  if (tries === 2) continue;
}
do { tries--; } while (tries > 0);
const store = new Store("sales");
export default store;
