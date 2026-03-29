// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "cleanSites") {
    cleanSites(message.domains, message.options)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // 保持消息通道开放
  }
});

// 清除指定网站的数据
async function cleanSites(domains, options) {
  const tasks = [];

  for (const domain of domains) {
    // 清除 Cookies
    if (options.cookies) {
      tasks.push(removeCookies(domain));
    }

    // 清除缓存 (使用 browsingData API)
    if (options.cache) {
      tasks.push(removeCacheForDomain(domain));
    }

    // 清除 localStorage / sessionStorage / indexedDB 需要在页面上下文中执行
    if (options.localStorage || options.sessionStorage || options.indexedDB) {
      tasks.push(removeStorageData(domain, options));
    }
  }

  await Promise.allSettled(tasks);
}

// 删除指定域名的所有 Cookies
async function removeCookies(domain) {
  // 获取该域名的所有 cookies（包含子域名）
  const urls = [`http://${domain}`, `https://${domain}`];
  const cookiePromises = urls.map((url) => chrome.cookies.getAll({ url }));
  const results = await Promise.all(cookiePromises);
  const cookies = results.flat();

  // 去重
  const seen = new Set();
  const unique = cookies.filter((c) => {
    const key = `${c.name}|${c.domain}|${c.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const removePromises = unique.map((cookie) => {
    const protocol = cookie.secure ? "https" : "http";
    const url = `${protocol}://${cookie.domain.replace(/^\./, "")}${cookie.path}`;
    return chrome.cookies.remove({ url, name: cookie.name });
  });

  await Promise.allSettled(removePromises);
}

// 通过 browsingData API 清除指定域名的缓存
async function removeCacheForDomain(domain) {
  await chrome.browsingData.removeCache({
    origins: [`https://${domain}`, `http://${domain}`],
  });
}

// 清除存储数据 (localStorage, sessionStorage, indexedDB)
async function removeStorageData(domain, options) {
  const dataToRemove = {};
  if (options.localStorage) dataToRemove.localStorage = true;
  if (options.indexedDB) dataToRemove.indexedDB = true;
  // sessionStorage 无法通过 browsingData API 清除，需注入脚本

  if (Object.keys(dataToRemove).length > 0) {
    try {
      await chrome.browsingData.remove(
        { origins: [`https://${domain}`, `http://${domain}`] },
        dataToRemove
      );
    } catch {
      // 某些数据类型可能不支持 origins 过滤，忽略错误
    }
  }

  // sessionStorage 需要在活跃标签页中清除
  if (options.sessionStorage) {
    await clearSessionStorageInTabs(domain);
  }
}

// 在匹配的标签页中清除 sessionStorage
async function clearSessionStorageInTabs(domain) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      const url = new URL(tab.url);
      const tabDomain = url.hostname.replace(/^www\./, "");
      if (tabDomain === domain || tabDomain.endsWith(`.${domain}`)) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => sessionStorage.clear(),
        });
      }
    } catch {
      // 忽略无法注入脚本的标签页（如 chrome:// 页面）
    }
  }
}
