/* Navbar Component Loader */

let navbarResizeObserver;

function refreshNavbarHeight() {
  const navbarContainer = document.getElementById("navbar");
  if (!navbarContainer) return;

  const height = navbarContainer.offsetHeight || 64;
  document.documentElement.style.setProperty("--navbar-height", `${height}px`);
}

async function loadNavbar() {
  try {
    const resp = await fetch("/partials/navbar.html");
    if (!resp.ok) return;

    const target = document.getElementById("navbar");
    if (!target) return;

    target.innerHTML = await resp.text();
    refreshNavbarHeight();

    // Setup Bootstrap collapse listeners
    const navCollapse = target.querySelector("#navbarNav");
    if (navCollapse) {
      navCollapse.addEventListener("shown.bs.collapse", refreshNavbarHeight);
      navCollapse.addEventListener("hidden.bs.collapse", refreshNavbarHeight);
    }

    // Setup resize observer
    if (window.ResizeObserver) {
      if (navbarResizeObserver) {
        navbarResizeObserver.disconnect();
      }
      navbarResizeObserver = new ResizeObserver(refreshNavbarHeight);
      navbarResizeObserver.observe(target);
    }
  } catch (err) {
    console.error("Failed to load navbar:", err);
  }
}

// Initialize
loadNavbar();
window.addEventListener("resize", refreshNavbarHeight);
