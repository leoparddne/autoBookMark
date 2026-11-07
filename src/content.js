/**
 * 内容脚本：SPA 站点（如 B 站）切集时 URL 变化不一定触发后台的 tabs.onUpdated，
 * 这里监听 URL 变化并通知后台处理。
 */

(function () {
  let lastUrl = location.href;

  function notifyIfChanged() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      chrome.runtime.sendMessage({ type: 'urlChanged' }).catch(() => {});
    }
  }

  // 监听 history API 调用
  const rawPush = history.pushState;
  history.pushState = function () {
    rawPush.apply(this, arguments);
    notifyIfChanged();
  };

  const rawReplace = history.replaceState;
  history.replaceState = function () {
    rawReplace.apply(this, arguments);
    notifyIfChanged();
  };

  // 兜底：popstate 与定时轮询（覆盖直接改 hash 等情况）
  window.addEventListener('popstate', notifyIfChanged);
  setInterval(notifyIfChanged, 1000);
})();
