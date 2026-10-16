(() => {
  const pages = [
    { title: "概览", description: "理解管理端、玩家端、三种维护方式与完整工作链路。", href: "./index.html", keywords: "概览 服主 玩家 工作流程 自托管 不替代启动器 普通同步 强制同步 首次提供 桌面版 终端版 网页 交互式命令行" },
    { title: "下载与首次配置", description: "桌面版解压直接运行；终端版跟着首次引导完成设置。", href: "./quickstart.html", keywords: "下载 解压 安装 管理端 首次运行 引导 data 8080 18080 SSH 桌面版 桌面端 终端版 命令行版 DreamingFishAdminDesktop 两个版本 免安装 便携版 安装版 Windows Server WebView2 Linux" },
    { title: "创建第一个项目", description: "创建项目、导入文件、设置维护方式、检查发布、生成部署包并完成启动器接入。", href: "./create-project.html", keywords: "创建项目 项目 ID 玩家更新地址 Web 配置 管理账户 导入清单 上传并检查 确认导入 替换旧模组 维护方式 普通同步 强制同步 首次提供 改动与版本 检查并发布 发放 玩家端程序 发行 ZIP 部署 ZIP 下载服务 命令行 终端 project policy preset 首次部署包 PCL HMCL Java Agent javaagent JVM arguments.jvm 版本 JSON 版本隔离 game_directory gameDir verpath" },
    { title: "日常维护", description: "加文件、删文件、处理问题版本、撤回操作、回滚、外部托管、备份与升级。", href: "./maintenance.html", keywords: "维护 更新 加文件 删文件 移出 移除玩家副本 留给玩家 停止维护 可选内容 历史问题文件 坏版本 修复玩家副本 玩家端设计 个性化 操作记录 撤销 恢复当前发布设置 回滚 发布版本 外部托管 WebDAV 对象存储 S3 OSS CDN 备份 恢复 升级 多项目" },
    { title: "远程管理与 AI agent", description: "用桌面版的 SSH 连接管理服务器上的终端版；用参数式命令把维护交给脚本或 AI agent。", href: "./admin.html", keywords: "远程 远程管理 桌面版 桌面端 SSH 连接 ssh config 密钥 ssh-keygen 管理地址 远程管理端口 18080 连接工作区 断开 托盘 运行日志 AI agent 脚本 自动化 参数式命令 命令行 json yes project files scan publish policy operations undo restore-published deployment export-static backup" },
    { title: "常见问题", description: "桌面版还是终端版、VPS 远程管理、玩家自选模组、维护方式、界面切换与玩家端程序等问题。", href: "./faq.html", keywords: "FAQ 桌面版 终端版 选哪个 新版界面 旧版界面 workbench legacy 8080 18080 VPS SSH 自选模组 豁免 停用 首次提供 跳过版本 标准目录 ZIP 新版界面 旧版界面 终端 Web 常驻 删除玩家端程序 版本号" },
    { title: "版本与更新日志", description: "当前组件版本、0.2.1 新增的桌面版与新版工作区，以及 0.2.0 的变化。", href: "./changelog.html", keywords: "更新日志 版本 玩家端 管理端 Agent 桌面版 新版工作区 0.2.1 0.2.0" }
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

(() => {
  const layout = document.querySelector(".docs-layout");
  const leftHandle = document.querySelector('[data-rail="left"]');
  const rightHandle = document.querySelector('[data-rail="right"]');
  if (!layout || !leftHandle || !rightHandle) return;

  const leftKey = "dfs-rail-left";
  const rightKey = "dfs-rail-right";

  const load = (key, fallback) => {
    try {
      const v = parseFloat(localStorage.getItem(key));
      return Number.isFinite(v) ? v : fallback;
    } catch (_) {
      return fallback;
    }
  };
  const save = (key, value) => {
    try {
      localStorage.setItem(key, String(value));
    } catch (_) {}
  };

  const apply = () => {
    if (window.innerWidth <= 1180) return;
    layout.style.setProperty("--rail-left", load(leftKey, 200) + "px");
    layout.style.setProperty("--rail-right", load(rightKey, 160) + "px");
  };

  const startDrag = (property, key, min, max, invert) => (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startValue = load(key, property === "--rail-left" ? 200 : 160);
    const move = (e) => {
      const delta = (e.clientX - startX) * (invert ? -1 : 1);
      const value = Math.min(max, Math.max(min, startValue + delta));
      layout.style.setProperty(property, value + "px");
      save(key, value);
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  leftHandle.addEventListener("pointerdown", startDrag("--rail-left", leftKey, 150, 330, false));
  rightHandle.addEventListener("pointerdown", startDrag("--rail-right", rightKey, 120, 280, true));
  apply();
  window.addEventListener("resize", apply);
})();
