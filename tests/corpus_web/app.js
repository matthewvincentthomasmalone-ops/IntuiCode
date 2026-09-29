// Bakery page behaviour
const orderButton = document.getElementById("order");
const form = document.getElementById("signup");

document.getElementById("order").addEventListener("click", () => {
  document.getElementById("menu").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("signup").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value;
  if (email === "") {
    alert("Please type your email first");
    return;
  }
  let saved = JSON.parse(localStorage.getItem("emails"));
  if (saved === null) {
    saved = [];
  }
  saved.push(email);
  localStorage.setItem("emails", JSON.stringify(saved));
  document.getElementById("thanks").hidden = false;
  document.getElementById("email").value = "";
});

function countItems(list) {
  let total = 0;
  for (const item of list) {
    if (item.length > 0) total++;
  }
  return total;
}

const items = ["Sourdough", "Rye", "Buns"];
console.log("Menu has", countItems(items), "items");

let hour = new Date().getHours();
if (hour < 7 || hour >= 15) {
  document.getElementById("order").textContent = "Order for tomorrow";
} else if (hour < 12) {
  console.log("Good morning!");
} else {
  console.log("Afternoon specials are on");
}

for (let i = 0; i < 3; i++) {
  console.log(`Batch ${i + 1} is in the oven`);
}

setTimeout(() => {
  console.log("Still here? Try the buns.");
}, 30000);
