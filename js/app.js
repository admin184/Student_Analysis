
const DIM_DEFS = [
  { key: 'storage', name: '磁盘存储管理', max: 20, indices: [0, 1], warn: '需加强分区持久化练习' },
  { key: 'environment', name: '基础环境构建', max: 30, indices: [2, 6], warn: '需熟悉 IP 配置与 YUM 环境' },
  { key: 'security', name: '安全合规配置', max: 20, indices: [3, 7], warn: '需关注防火墙策略放通' },
  { key: 'dns', name: 'DNS服务治理', max: 10, indices: [4], warn: '需掌握 bind 域名解析记录与校验' },
  { key: 'web', name: 'Web业务应用', max: 20, indices: [5], warn: '需加强 Apache 站点部署与连通性测试' },
];

let allStudents = [];
let filteredStudents = [];
let chartInstances = [];

const $ = (sel) => document.querySelector(sel);

function calcDimensions(scores) {
  const dims = {};
  for (const d of DIM_DEFS) {
    const actual = d.indices.reduce((sum, i) => sum + (scores[i] || 0), 0);
    const standard = d.max > 0 ? Math.round((actual / d.max) * 100 * 10) / 10 : 0;
    dims[d.key] = { score: actual, max: d.max, standard };
  }
  return dims;
}

function parseExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const students = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const scores = [];
    for (let c = 6; c <= 13; c++) {
      const v = parseFloat(r[c]);
      scores.push(isNaN(v) ? 0 : v);
    }
    students.push({
      id: String(r[0] ?? ''),
      name: String(r[1] ?? ''),
      class: String(r[2] ?? ''),
      total: parseFloat(r[3]) || 0,
      dimensions: calcDimensions(scores),
    });
  }
  return students;
}

function loadPreset() {
  fetch('data/students.json')
    .then(r => {
      if (!r.ok) throw new Error('无法加载预设数据');
      return r.json();
    })
    .then(data => {
      allStudents = data;
      applyFilter();
      showToast('已加载预设数据', 'success');
    })
    .catch(err => showToast(err.message, 'error'));
}

function applyFilter() {
  const q = $('#searchInput').value.trim().toLowerCase();
  filteredStudents = q
    ? allStudents.filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q))
    : [...allStudents];
  render();
}

function getEval(standard) {
  if (standard >= 90) return { text: '熟练掌握', cls: 'badge-expert' };
  if (standard >= 60) return { text: '基本达标', cls: 'badge-pass' };
  return { text: '预警建议', cls: 'badge-warning' };
}

function render() {
  const container = $('#dashboard');
  const empty = $('#emptyState');
  const stats = $('#statsBar');
  const statsText = $('#statsText');

  chartInstances.forEach(c => c.dispose());
  chartInstances = [];

  if (filteredStudents.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    stats.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  stats.style.display = 'block';
  statsText.textContent = `共 ${filteredStudents.length} 人${allStudents.length !== filteredStudents.length ? '（筛选后）' : ''}`;

  container.innerHTML = filteredStudents.map((s, idx) => `
    <div class="card" data-index="${idx}">
      <div class="card-header">
        <div>
          <div class="card-title">${escapeHtml(s.name)}</div>
          <div class="card-meta">${escapeHtml(s.class)} · ${escapeHtml(s.id)} · 总分 ${s.total}</div>
        </div>
        <div class="card-score">${s.total}</div>
      </div>
      <div class="chart-container" id="chart-${idx}"></div>
      <div class="evaluation">
        ${DIM_DEFS.map(d => {
          const dim = s.dimensions[d.key];
          const ev = getEval(dim.standard);
          const warnText = dim.standard < 60 ? ` · ${d.warn}` : '';
          return `
            <div class="eval-item" title="${dim.score}/${dim.max} 分">
              <span class="eval-label">${d.name}${warnText}</span>
              <span class="eval-badge ${ev.cls}">${ev.text}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  filteredStudents.forEach((s, idx) => {
    const el = document.getElementById(`chart-${idx}`);
    if (!el) return;
    const chart = echarts.init(el);
    chartInstances.push(chart);

    const indicator = DIM_DEFS.map(d => ({ name: d.name, max: 100 }));
    const values = DIM_DEFS.map(d => s.dimensions[d.key].standard);

    chart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: () => {
          return DIM_DEFS.map(d => {
            const dim = s.dimensions[d.key];
            return `${d.name}: ${dim.standard}分（${dim.score}/${dim.max}）`;
          }).join('<br>');
        },
        backgroundColor: 'rgba(15,23,42,0.95)',
        borderColor: '#334155',
        textStyle: { color: '#f1f5f9' },
      },
      radar: {
        indicator,
        shape: 'polygon',
        splitNumber: 5,
        axisName: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.15)' } },
        splitArea: {
          areaStyle: {
            color: ['rgba(56,189,248,0.02)', 'rgba(56,189,248,0.04)', 'rgba(56,189,248,0.06)', 'rgba(56,189,248,0.08)', 'rgba(56,189,248,0.10)'],
          },
        },
        axisLine: { lineStyle: { color: 'rgba(148,163,184,0.15)' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: values,
              name: s.name,
              areaStyle: { color: 'rgba(56,189,248,0.25)' },
              lineStyle: { color: '#38bdf8', width: 2 },
              itemStyle: { color: '#38bdf8' },
              symbol: 'circle',
              symbolSize: 6,
            },
          ],
        },
      ],
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[<>"'&]/g, c => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c]));
}

function showToast(msg, type) {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const students = parseExcel(e.target.result);
      if (students.length === 0) {
        showToast('未识别到有效学生数据', 'error');
        return;
      }
      allStudents = students;
      applyFilter();
      showToast(`成功导入 ${students.length} 条数据`, 'success');
    } catch (err) {
      showToast('解析失败: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

$('#searchInput').addEventListener('input', applyFilter);

$('#fileInput').addEventListener('change', (e) => {
  handleFile(e.target.files[0]);
  e.target.value = '';
});

$('#loadPresetBtn').addEventListener('click', loadPreset);

const dropZone = $('#dropZone');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
  document.body.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
});

document.body.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
document.body.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) dropZone.classList.remove('dragover');
});
document.body.addEventListener('drop', (e) => {
  dropZone.classList.remove('dragover');
  handleFile(e.dataTransfer.files[0]);
});

window.addEventListener('resize', () => {
  chartInstances.forEach(c => c.resize());
});
