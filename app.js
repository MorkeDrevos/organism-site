async function fetchOrganismStatus() {
  try {
    const response = await fetch("https://organism-backend.onrender.com/health");
    const data = await response.json();

    // Update organism status
    document.getElementById("status").innerText = `Status: ${data.status}`;
    document.getElementById("price").innerText = `Price: $${data.price}`;
    document.getElementById("timestamp").innerText = `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;

    // Update health bar dynamically (example)
    const healthBar = document.getElementById("health-bar");
    healthBar.style.width = data.price > 0 ? `${Math.min(data.price * 10, 100)}%` : "5%";

  } catch (err) {
    console.error("Error fetching organism status:", err);
    document.getElementById("status").innerText = "Status: Offline";
  }
}

// Refresh every 10 seconds
setInterval(fetchOrganismStatus, 10000);

// Call once on page load
fetchOrganismStatus();
