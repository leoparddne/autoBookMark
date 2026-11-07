/** 设置页逻辑：增删改站点规则并保存 */

let rules = [];

const rowsEl = document.getElementById('ruleRows');
const emptyEl = document.getElementById('empty');
const statusEl = document.getElementById('status');

function render() {
  rowsEl.innerHTML = '';
  emptyEl.style.display = rules.length ? 'none' : 'block';

  rules.forEach((rule, index) => {
    const tr = document.createElement('tr');

    // 域名
    const tdDomain = document.createElement('td');
    const inputDomain = document.createElement('input');
    inputDomain.type = 'text';
    inputDomain.value = rule.domain || '';
    inputDomain.placeholder = 'www.bilibili.com';
    inputDomain.addEventListener('input', () => { rule.domain = inputDomain.value.trim(); });
    tdDomain.appendChild(inputDomain);

    // 匹配模式（正则，匹配完整 URL）
    const tdPattern = document.createElement('td');
    const inputPattern = document.createElement('input');
    inputPattern.type = 'text';
    inputPattern.value = rule.pattern || '';
    inputPattern.placeholder = 'https://www\\.bilibili\\.com/video/(BV\\w+)/?[^#]*';
    inputPattern.addEventListener('input', () => { rule.pattern = inputPattern.value.trim(); });
    tdPattern.appendChild(inputPattern);

    // 启用
    const tdEnabled = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = rule.enabled !== false;
    checkbox.addEventListener('change', () => { rule.enabled = checkbox.checked; });
    tdEnabled.appendChild(checkbox);

    // 删除
    const tdOps = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', () => {
      rules.splice(index, 1);
      render();
    });
    tdOps.appendChild(delBtn);

    tr.append(tdDomain, tdPattern, tdEnabled, tdOps);
    rowsEl.appendChild(tr);
  });
}

function showStatus(text) {
  statusEl.textContent = text;
  setTimeout(() => { statusEl.textContent = ''; }, 2000);
}

document.getElementById('addBtn').addEventListener('click', () => {
  rules.push({ domain: '', pattern: '', enabled: true });
  render();
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  // 过滤掉不完整的规则
  const valid = rules.filter(r => r.domain && r.pattern);
  for (const r of valid) {
    try {
      new RegExp(r.pattern);
    } catch {
      showStatus(`正则非法：${r.pattern}`);
      return;
    }
  }
  const config = await loadConfig();
  config.rules = valid;
  await saveConfig(config);
  rules = valid;
  render();
  showStatus('已保存');
});

(async function init() {
  const config = await loadConfig();
  rules = (config.rules || []).map(r => ({ ...r }));
  render();
})();
