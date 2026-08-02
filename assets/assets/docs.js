(() => {
  const pages = [
    { title: "概览", description: "理解管理端、玩家端与完整工作链路。", href: "./index.html", keywords: "概览 服主 玩家 工作流程 自托管 不替代启动器" },
    { title: "完整部署教程", description: "从管理端安装到玩家首次启动，覆盖 Web 与交互终端。", href: "./quickstart.html", keywords: "部署 安装 Web 终端 SSH 项目 玩家程序 首次发布 玩家实例 PCL javaagent 8080 18080" },
    { title: "管理端功能", description: "管理端能力、数据边界、端口与 Web/终端关系。", href: "./admin.html", keywords: "管理端 项目 源文件 扫描 发布 回滚 备份 恢复 多项目 data" },
    { title: "扫描、发布与版本", description: "扫描预览、移除处理、不可变发布、版本与回滚。", href: "./publish.html", keywords: "扫描 发布 移除 删除 放弃管理 版本 回滚 玩家端程序" },
    { title: "玩家端功能与接入", description: "启动前检查、界面、日志、本地管理与启动器接入。", href: "./player.html", keywords: "玩家端 PCL HMCL 启动器 javaagent 更新记录 日志 新闻 模组启停 本地文件" },
    { title: "同步策略与本地管理", description: "默认同步、强制同步、玩家豁免与模组启停。", href: "./sync.html", keywords: "默认同步 强制同步 强制目录 强制文件 玩家本地豁免 模组启停 放弃管理 归档" },
    { title: "安全、离线与事务恢复", description: "Ed25519 签名、SHA-256 传输校验、路径安全、原子安装与离线边界。", href: "./offline.html", keywords: "安全 Ed25519 SHA-256 哈希 签名 防重放 传输 Range 原子事务 备份 恢复 路径安全 离线启动 归档" },
    { title: "常见问题", description: "端口、完整包、玩家程序、VPS 与自选模组问题。", href: "./faq.html", keywords: "FAQ 8080 18080 完整包 VPS SSH 自选模组 标准目录 Web 常驻" },
    { title: "版本与更新日志", description: "当前组件版本与近期主要改进。", href: "./changelog.html", keywords: "更新日志 版本 玩家端 管理端 Agent" }
  ];

  const modal = document.querySelector("[data-search-modal]");
  const input = document.querySelector("[data-search-input]");
  const results = document.querySelector("[data-search-results]");
  const sidebar = document.querySelector("[data-docs-sidebar]");
  let selected = 0;

  const copyText = async (text) => {
    if (!text) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_) {}
    field.remove();
    return ok;
  };

  const matches = () => {
    const query = (input?.value || "").trim().toLowerCase();
    if (!query) return pages.slice(0, 7);
    return pages.filter((page) =>
      `${page.title} ${page.description} ${page.keywords}`.toLowerCase().includes(query)
    );
  };

  const render = () => {
    if (!results) return;
    const list = matches();
    selected = Math.min(selected, Math.max(0, list.length - 1));
    results.innerHTML = list.length
      ? list.map((page, index) =>
          `<a class="search-result ${index === selected ? "selected" : ""}" href="${page.href}">` +
          `<strong>${page.title}</strong><span>${page.description}</span></a>`
        ).join("")
      : '<div class="search-empty">没有找到相关文档</div>';
  };

  const openSearch = () => {
    modal?.classList.add("open");
    selected = 0;
    render();
    window.setTimeout(() => input?.focus(), 20);
  };
  const closeSearch = () => {
    modal?.classList.remove("open");
    if (input) input.value = "";
    selected = 0;
  };

  document.querySelector("[data-search-open]")?.addEventListener("click", openSearch);
  modal?.addEventListener("click", (event) => { if (event.target === modal) closeSearch(); });
  input?.addEventListener("input", () => { selected = 0; render(); });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
      return;
    }
    if (!modal?.classList.contains("open")) return;
    const list = matches();
    if (event.key === "Escape") closeSearch();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selected = Math.min(selected + 1, Math.max(0, list.length - 1));
      render();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selected = Math.max(selected - 1, 0);
      render();
    }
    if (event.key === "Enter" && list[selected]) window.location.href = list[selected].href;
  });

  document.querySelectorAll(".copy-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button.closest(".code-block")?.querySelector("code")?.textContent || "";
      const ok = await copyText(text);
      button.textContent = ok ? "已复制" : "请手动复制";
      window.setTimeout(() => { button.textContent = "复制"; }, 1400);
    });
  });

  document.querySelectorAll(".anchor-link").forEach((link) => {
    link.addEventListener("click", () => {
      const url = `${window.location.href.split("#")[0]}${link.getAttribute("href") || ""}`;
      copyText(url);
    });
  });

  document.querySelector("[data-docs-toggle]")?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
  });
  document.addEventListener("click", (event) => {
    if (window.innerWidth > 900 || !sidebar?.classList.contains("open")) return;
    if (!sidebar.contains(event.target) && !event.target.closest("[data-docs-toggle]")) {
      sidebar.classList.remove("open");
    }
  });

  const tocLinks = [...document.querySelectorAll("[data-toc]")];
  if (tocLinks.length && "IntersectionObserver" in window) {
    const sections = tocLinks.map((link) => document.getElementById(link.dataset.toc)).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!current) return;
      tocLinks.forEach((link) => link.classList.toggle("active", link.dataset.toc === current.target.id));
    }, { rootMargin: "-92px 0px -70% 0px", threshold: [0, 1] });
    sections.forEach((section) => observer.observe(section));
  }
})();
