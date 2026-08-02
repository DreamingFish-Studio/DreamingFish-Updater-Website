(() => {
  const root = document.documentElement;
  const key = "dfs-theme";
  const applyTheme = (value) => {
    const theme = value === "dark" ? "dark" : "light";
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const target = theme === "light" ? "深色" : "白天";
      button.setAttribute("aria-label", `切换到${target}模式`);
      button.setAttribute("title", `切换到${target}模式`);
    });
  };
  let initial = root.dataset.theme || "light";
  try { initial = localStorage.getItem(key) || initial; } catch (_) {}
  applyTheme(initial);
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => button.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(key, next); } catch (_) {}
  }));
  const toggle = document.querySelector("[data-mobile-toggle]");
  const nav = document.querySelector("[data-nav-links]");
  const header = document.querySelector(".site-header");
  const navLinks = nav ? [...nav.querySelectorAll('a[href^="#"]')] : [];

  const setActiveNav = (hash) => {
    navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === hash));
  };

  const validNavHashes = new Set(navLinks.map((link) => link.getAttribute("href")));
  setActiveNav(validNavHashes.has(window.location.hash) ? window.location.hash : "#update");
  window.addEventListener("hashchange", () => {
    if (validNavHashes.has(window.location.hash)) setActiveNav(window.location.hash);
  });

  navLinks.forEach((link) => link.addEventListener("click", (event) => {
    const hash = link.getAttribute("href");
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (!target) return;
    event.preventDefault();
    const headerOffset = header?.getBoundingClientRect().height || 0;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset - 12);
    window.scrollTo({ top, behavior: "smooth" });
    window.history.replaceState(null, "", hash);
    setActiveNav(hash);
    nav?.classList.remove("open");
  }));

  if (navLinks.length && "IntersectionObserver" in window) {
    const sections = navLinks
      .map((link) => document.getElementById(link.getAttribute("href").slice(1)))
      .filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (current) setActiveNav(`#${current.target.id}`);
    }, { rootMargin: "-88px 0px -58% 0px", threshold: [0, .2, .6] });
    sections.forEach((section) => observer.observe(section));
  }

  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => nav.classList.remove("open")));
  }

  const productStage = document.querySelector(".dual-product-stage");
  const productCards = productStage ? [...productStage.querySelectorAll("[data-product-card]")] : [];
  const setProductPriority = (priority) => {
    if (!productStage) return;
    productStage.classList.toggle("priority-admin", priority === "admin");
    productStage.classList.toggle("priority-player", priority === "player");
    productCards.forEach((card) => {
      const isPriority = card.dataset.productCard === priority;
      card.setAttribute("aria-pressed", String(isPriority));
      card.classList.toggle("is-priority", isPriority);
    });
  };
  productCards.forEach((card) => {
    const choose = () => setProductPriority(card.dataset.productCard);
    card.addEventListener("click", choose);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose();
      }
    });
  });
  productStage?.addEventListener("pointerdown", (event) => {
    const card = event.target.closest?.("[data-product-card]");
    if (card) setProductPriority(card.dataset.productCard);
  }, true);
  setProductPriority(productStage?.classList.contains("priority-admin") ? "admin" : "player");

  const reveal = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
    }), { threshold: .1, rootMargin: "0px 0px -4% 0px" });
    reveal.forEach((element) => observer.observe(element));
  } else reveal.forEach((element) => element.classList.add("visible"));
})();
