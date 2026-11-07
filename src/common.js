/**
 * 公共模块：配置存储 + 规则匹配
 */

const DEFAULT_CONFIG = {
  // 站点规则列表
  // 每条规则：{ domain, pattern, enabled }
  //   domain  : 站点域名，如 www.bilibili.com
  //   pattern : 正则，用来匹配「完整 URL」（含查询参数），
  //             通过第一个捕获组把同一课程/视频的不同集归为同一个收藏项。
  //   例（B 站）：https://www\.bilibili\.com/video/(BV\w+)/?[^#]*
  //             捕获组1 = 视频号(BV...)，用于区分不同视频
  rules: []
};

/** 读取配置 */
async function loadConfig() {
  const { config } = await chrome.storage.local.get('config');
  return config || DEFAULT_CONFIG;
}

/** 保存配置 */
async function saveConfig(config) {
  await chrome.storage.local.set({ config });
}

/** 从 URL 中取出域名 */
function getHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * 判断某个 URL 命中的规则。
 * 返回命中的规则对象，未命中返回 null。
 */
function matchRule(url, config) {
  const host = getHost(url);
  if (!host) return null;
  for (const rule of config.rules || []) {
    if (!rule.enabled) continue;
    if (rule.domain !== host) continue;
    try {
      if (new RegExp(rule.pattern).test(url)) return rule;
    } catch {
      // 非法正则忽略
    }
  }
  return null;
}

/**
 * 计算收藏项的唯一键（key）。
 * key = 域名 + 正则 + 第一个捕获组内容。
 * 只用「第一个捕获组」区分不同课程/视频（如 B 站的 BV 号），
 * 后续捕获组（如集数 p）仅用于正则匹配校验，不参与 key，
 * 这样同一视频的任意一集都会命中同一个收藏项。
 * 若无捕获组，则退化为 域名 + 正则，整个规则对应一个收藏项。
 */
function getCourseKey(url, rule) {
  const host = getHost(url);
  const group = getGroup1(url, rule) || '';
  return `${host}|${rule.pattern}|${group}`;
}

/** 取出 URL 中第一个捕获组的内容（如 B 站的 BV 号），无捕获组返回 null */
function getGroup1(url, rule) {
  try {
    const m = url.match(new RegExp(rule.pattern));
    return m && m[1] !== undefined ? m[1] : null;
  } catch {
    return null;
  }
}

/** 生成一个便于人读的规则描述 */
function describeRule(rule) {
  return `${rule.domain}  ${rule.pattern}`;
}
