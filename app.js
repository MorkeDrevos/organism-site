const priceLabel = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const tradesBody = document.getElementById("trades-body");

async function pollPrice() {
  const res = await fetch("https://organism-backend.onrender.com/health");
  const j = await res.json();
  priceLabel.textContent = `$${j.price.toFixed(6)}`;
  updatedLabel.textContent = new Date(j.ts).toLocaleTimeString();
}

async function pollTrades() {
  const res = await fetch("https://organism-backend.onrender.com/trades");
  const j = await res.json();
  tradesBody.innerHTML = "";
  j.forEach(tr => {
    const row = document.createElement("tr");
    const usdVal = (tr.price * tr.amount).toFixed(2);
    const time = new Date(tr.ts).toLocaleTimeString();
    row.innerHTML = `
      <td>${time}</td>
      <td class="${tr.side === "buy" ? "feed" : "starve"}">${tr.side === "buy" ? "Feed" : "Starve"}</td>
      <td>$${usdVal}</td>
      <td>$${tr.price.toFixed(6)}</td>
    `;
    tradesBody.appendChild(row);
  });
}

// Run schedulers
pollPrice();
pollTrades();
setInterval(pollPrice, 6000);
setInterval(pollTrades, 6000);
