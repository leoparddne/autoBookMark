/** 弹窗：显示当前页匹配情况，支持手动立即更新 */

const msgEl = document.getElementById('msg');
const urlEl = document.getElementById('url');

/**
 * 查找同一课程/视频的收藏项：优先完全一致，其次第一个捕获组相同。
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

document.getElementById('optionsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('updateBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) { msgEl.textContent = '无法获取当前页面'; return; }

  const config = await loadConfig();
  const rule = matchRule(tab.url, config);
  if (!rule) {
    msgEl.textContent = '当前页面未命中任何规则，请先在设置中添加。';
    return;
  }

  const targetGroup = getGroup1(tab.url, rule);
  const tree = await chrome.bookmarks.getTree();
  const target = findBookmarkForCourse(tree, tab.url, rule, targetGroup);

  if (target) {
    await chrome.bookmarks.update(target.id, { title: tab.title, url: tab.url });
    msgEl.textContent = `已更新收藏项：${tab.title}`;
  } else {
    const parentId = getOtherBookmarksId(tree);
    await chrome.bookmarks.create({ parentId, title: tab.title, url: tab.url });
    msgEl.textContent = `已新建收藏项：${tab.title}`;
  }
});

/** 从收藏夹树中取“其他书签”文件夹的 id */
function getOtherBookmarksId(tree) {
  const root = tree[0];
  if (root && root.children) {
    for (const child of root.children) {
      if (child.id === '2') return child.id;
    }
    const other = root.children.find(c => c.id !== '1' && c.children);
    if (other) return other.id;
  }
  return '2';
}

(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) { msgEl.textContent = '无法获取当前页面'; return; }
  urlEl.textContent = tab.url;

  const config = await loadConfig();
  const rule = matchRule(tab.url, config);
  msgEl.textContent = rule
    ? `已命中规则，页面加载后将自动更新收藏夹。`
    : '当前页面未命中任何规则。';
})();
