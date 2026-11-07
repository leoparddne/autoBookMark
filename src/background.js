/**
 * 后台 Service Worker：
 * 页面加载/切换完成后，若命中站点规则，则更新（或首次创建）收藏夹。
 */

importScripts('common.js');

// 已处理过的 key -> 上次更新时间戳，避免短时间内重复处理
const recentlyHandled = new Map();
const HANDLE_COOLDOWN_MS = 2000;

/**
 * 递归遍历收藏夹树，查找“属于同一课程/视频”的收藏项。
 * 判定方式（按优先级）：
 *   1) 收藏项 URL 与当前 URL 完全相同
 *   2) 收藏项 URL 命中同一规则，且第一个捕获组（如 BV 号）与当前一致
 * 注意：不要求收藏项的集数参数与当前页一致，否则永远匹配不上。
 */
function findBookmarkForCourse(nodes, currentUrl, rule, targetGroup) {
  for (const node of nodes) {
    if (node.url) {
      if (node.url === currentUrl) return node;
      const nodeGroup = getGroup1(node.url, rule);
      if (nodeGroup && nodeGroup === targetGroup) return node;
    }
    if (node.children) {
      const found = findBookmarkForCourse(node.children, currentUrl, rule, targetGroup);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 处理一个标签页：命中规则则更新（或首次创建）收藏夹。
 * - 已存在同课程收藏项：直接更新它（位置、父文件夹、排序不变）
 * - 不存在：在“其他书签”根目录新建一条
 */
async function handleTab(tabId, url, title) {
  if (!url || !/^https?:/i.test(url)) return;
  if (!title) return;

  const config = await loadConfig();
  const rule = matchRule(url, config);
  if (!rule) return;

  // 当前页第一个捕获组（如 BV 号）
  const targetGroup = getGroup1(url, rule);

  const key = `${getHost(url)}|${rule.pattern}|${targetGroup || ''}`;
  const now = Date.now();
  const last = recentlyHandled.get(key) || 0;
  if (now - last < HANDLE_COOLDOWN_MS) return;
  recentlyHandled.set(key, now);

  const tree = await chrome.bookmarks.getTree();
  const target = findBookmarkForCourse(tree, url, rule, targetGroup);

  if (target) {
    // 已经是最新则跳过
    if (target.url === url && target.title === title) return;
    // 直接更新旧书签：位置不变
    await chrome.bookmarks.update(target.id, { title, url });
  } else {
    // 首次：在“其他书签”里新建
    const parentId = getOtherBookmarksId(tree);
    await chrome.bookmarks.create({ parentId, title, url });
  }
}

/** 从收藏夹树中取“其他书签”文件夹的 id */
function getOtherBookmarksId(tree) {
  // 根节点结构：[{ children: [书签栏, 其他书签, 移动设备书签] }]
  const root = tree[0];
  if (root && root.children) {
    for (const child of root.children) {
      if (child.id === '2') return child.id; // “其他书签”固定 id 为 2
    }
    // 兜底：取非“书签栏”(id=1) 的第一个文件夹
    const other = root.children.find(c => c.id !== '1' && c.children);
    if (other) return other.id;
  }
  return '2';
}

/**
 * 延迟处理：等页面/SPA 把标题更新好再写入收藏夹。
 * 记录每个标签页的待处理定时器，URL 连续变化时只保留最后一次。
 */
const pendingTimers = new Map();
const HANDLE_DELAY_MS = 1200;

function scheduleHandle(tabId) {
  const old = pendingTimers.get(tabId);
  if (old) clearTimeout(old);
  const timer = setTimeout(async () => {
    pendingTimers.delete(tabId);
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.url) await handleTab(tabId, tab.url, tab.title);
    } catch {}
  }, HANDLE_DELAY_MS);
  pendingTimers.set(tabId, timer);
}

// 页面加载完成 / SPA 改 URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    scheduleHandle(tabId);
    return;
  }
  // SPA 场景：URL 变化（切集）时 changeInfo 里带 url，但不触发 complete
  if (changeInfo.url) {
    scheduleHandle(tabId);
  }
});

// 切换标签页
chrome.tabs.onActivated.addListener(({ tabId }) => {
  scheduleHandle(tabId);
});

// SPA 内 history.pushState/replaceState 不一定触发 onUpdated，用内容脚本兜底
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'urlChanged' && sender.tab) {
    scheduleHandle(sender.tab.id);
  }
});

// 扩展安装时打开设置页
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});
