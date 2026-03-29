// 状态
let sites = [];

// DOM 元素
const siteInput = document.getElementById("siteInput");
const addBtn = document.getElementById("addBtn");
const addCurrentBtn = document.getElementById("addCurrentBtn");
const siteList = document.getElementById("siteList");
const siteCount = document.getElementById("siteCount");
const selectAllRow = document.getElementById("selectAllRow");
const selectAll = document.getElementById("selectAll");
const cleanBtn = document.getElementById("cleanBtn");
const cleanAllBtn = document.getElementById("cleanAllBtn");
const cleanOptions = document.getElementById("cleanOptions");
const toast = document.getElementById("toast");

// 初始化
document.addEventListener("DOMContentLoaded", loadSites);

// 事件绑定
addBtn.addEventListener("click", () => addSite(siteInput.value));
siteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite(siteInput.value);
});
addCurrentBtn.addEventListener("click", addCurrentSite);
selectAll.addEventListener("change", toggleSelectAll);
cleanBtn.addEventListener("click", cleanSelected);
cleanAllBtn.addEventListener("click", cleanAllSites);

// 清除选项切换样式
cleanOptions.querySelectorAll(".option-tag").forEach((tag) => {
  const checkbox = tag.querySelector("input");
  checkbox.addEventListener("change", () => {
    tag.classList.toggle("active", checkbox.checked);
  });
});

// 从 storage 加载网站列表
function loadSites() {
  chrome.storage.local.get("sites", (data) => {
    sites = data.sites || [];
    renderSites();
  });
}

// 保存网站列表
function saveSites() {
  chrome.storage.local.set({ sites });
}

// 标准化域名
function normalizeDomain(input) {
  let domain = input.trim().toLowerCase();
  // 去掉协议前缀
  domain = domain.replace(/^https?:\/\//, "");
  // 去掉路径
  domain = domain.split("/")[0];
  // 去掉端口
  domain = domain.split(":")[0];
  // 去掉 www.
  domain = domain.replace(/^www\./, "");
  return domain;
}

// 添加网站
function addSite(input) {
  const domain = normalizeDomain(input);
  if (!domain || !domain.includes(".")) {
    showToast("请输入有效的域名");
    return;
  }
  if (sites.includes(domain)) {
    showToast("该网站已存在");
    return;
  }
  sites.push(domain);
  saveSites();
  renderSites();
  siteInput.value = "";
  showToast(`已添加 ${domain}`);
}

// 添加当前网站
function addCurrentSite() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) {
      showToast("无法获取当前网页");
      return;
    }
    try {
      const url = new URL(tabs[0].url);
      if (url.protocol === "chrome:" || url.protocol === "edge:") {
        showToast("不支持浏览器内部页面");
        return;
      }
      addSite(url.hostname);
    } catch {
      showToast("无法解析当前网页地址");
    }
  });
}

// 渲染网站列表
function renderSites() {
  if (sites.length === 0) {
    siteList.innerHTML = '<div class="empty-state">暂无网站，请添加需要清除的网站</div>';
    siteCount.textContent = "";
    selectAllRow.style.display = "none";
    cleanBtn.disabled = true;
    cleanAllBtn.style.display = "none";
    return;
  }

  siteCount.textContent = `(${sites.length})`;
  selectAllRow.style.display = "flex";
  cleanAllBtn.style.display = "block";

  siteList.innerHTML = sites
    .map(
      (domain, i) => `
    <div class="site-item">
      <div class="site-info">
        <input type="checkbox" class="site-check" data-index="${i}">
        <span class="site-domain" title="${domain}">${domain}</span>
      </div>
      <button class="btn-remove" data-index="${i}" title="移除">&times;</button>
    </div>
  `
    )
    .join("");

  // 绑定移除按钮
  siteList.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      const domain = sites[idx];
      sites.splice(idx, 1);
      saveSites();
      renderSites();
      showToast(`已移除 ${domain}`);
    });
  });

  // 绑定复选框
  siteList.querySelectorAll(".site-check").forEach((cb) => {
    cb.addEventListener("change", updateCleanButton);
  });

  updateCleanButton();
}

// 更新清除按钮状态
function updateCleanButton() {
  const checked = siteList.querySelectorAll(".site-check:checked");
  cleanBtn.disabled = checked.length === 0;
  cleanBtn.textContent =
    checked.length > 0
      ? `清除选中网站数据 (${checked.length})`
      : "清除选中网站数据";

  const allChecks = siteList.querySelectorAll(".site-check");
  selectAll.checked = allChecks.length > 0 && checked.length === allChecks.length;
}

// 全选/取消全选
function toggleSelectAll() {
  const checked = selectAll.checked;
  siteList.querySelectorAll(".site-check").forEach((cb) => {
    cb.checked = checked;
  });
  updateCleanButton();
}

// 获取选中的清除选项
function getCleanOptions() {
  const options = {};
  cleanOptions.querySelectorAll("input:checked").forEach((cb) => {
    options[cb.value] = true;
  });
  return options;
}

// 清除选中网站的数据
async function cleanSelected() {
  const checked = siteList.querySelectorAll(".site-check:checked");
  const domains = Array.from(checked).map((cb) => sites[parseInt(cb.dataset.index)]);

  if (domains.length === 0) return;

  const options = getCleanOptions();
  if (Object.keys(options).length === 0) {
    showToast("请至少选择一种清除内容");
    return;
  }

  cleanBtn.disabled = true;
  cleanBtn.textContent = "清除中...";

  try {
    await chrome.runtime.sendMessage({
      action: "cleanSites",
      domains,
      options,
    });
    showToast(`已清除 ${domains.length} 个网站的数据`);
  } catch (err) {
    showToast("清除失败: " + err.message);
  }

  cleanBtn.disabled = false;
  updateCleanButton();
}

// 清除全部网站数据
async function cleanAllSites() {
  if (sites.length === 0) return;

  const options = getCleanOptions();
  if (Object.keys(options).length === 0) {
    showToast("请至少选择一种清除内容");
    return;
  }

  cleanAllBtn.textContent = "清除中...";

  try {
    await chrome.runtime.sendMessage({
      action: "cleanSites",
      domains: [...sites],
      options,
    });
    showToast(`已清除全部 ${sites.length} 个网站的数据`);
  } catch (err) {
    showToast("清除失败: " + err.message);
  }

  cleanAllBtn.textContent = "清除全部";
}

// Toast 提示
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}
