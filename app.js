const STORAGE_KEY = "CONCOST_SAMPLE_DATA_EDITABLE_V2";

const state = {
  view: "dashboard",
  year: null,
  query: ""
};

const viewMeta = {
  dashboard: {
    title: "대시보드",
    desc: "수주, 매출, 입금 데이터를 연도별로 빠르게 검토할 수 있습니다."
  },
  orders: {
    title: "수주 관리",
    desc: "수주 흐름, 외주 배분, 컨코스트 실적을 실무형 화면으로 정리합니다."
  },
  sales: {
    title: "매출 관리",
    desc: "발행 금액, 컨코스트 실적을 기준으로 검토하고 편집할 수 있습니다."
  },
  payments: {
    title: "입금 관리",
    desc: "청구 예정, 기수령, 지급예상일 기준으로 입금 현황을 관리할 수 있습니다."
  }
};

let DB = loadDB();

const yearSelect = document.getElementById("yearSelect");
const searchInput = document.getElementById("searchInput");
const viewRoot = document.getElementById("viewRoot");
const pageTitle = document.getElementById("pageTitle");
const pageDesc = document.getElementById("pageDesc");

const exportExcelBtn = document.getElementById("exportExcelBtn");
const importExcelBtn = document.getElementById("importExcelBtn");
const excelFileInput = document.getElementById("excelFileInput");
const resetDataBtn = document.getElementById("resetDataBtn");

const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalCloseBtn = document.getElementById("modalCloseBtn");

init();

function init() {
  refreshYearOptions();
  bindNav();
  bindFilters();
  bindModal();
  bindExcel();
  render();
}

function loadDB() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }
  const cloned = JSON.parse(JSON.stringify(SAMPLE_DATA || {}));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cloned));
  return cloned;
}

function saveDB() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}

function resetDB() {
  DB = JSON.parse(JSON.stringify(SAMPLE_DATA || {}));
  saveDB();
  refreshYearOptions();
  render();
}

function refreshYearOptions() {
  const years = getAllYears();
  state.year = years.includes(state.year) ? state.year : (years[0] || new Date().getFullYear().toString());

  yearSelect.innerHTML = years
    .map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}년</option>`)
    .join("");

  yearSelect.value = state.year;
}

function getAllYears() {
  return Array.from(
    new Set([
      ...Object.keys(DB.orders || {}),
      ...Object.keys(DB.sales || {}),
      ...Object.keys(DB.payments || {})
    ])
  ).sort((a, b) => Number(b) - Number(a));
}

function bindNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      state.view = btn.dataset.view;
      render();
    });
  });
}

function bindFilters() {
  yearSelect.addEventListener("change", (e) => {
    state.year = e.target.value;
    render();
  });

  searchInput.addEventListener("input", (e) => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  });

  resetDataBtn.addEventListener("click", () => {
    if (!confirm("현재 브라우저에 저장된 편집 데이터를 초기화하시겠습니까?")) return;
    resetDB();
  });
}

function bindModal() {
  modalCloseBtn.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
}

function bindExcel() {
  exportExcelBtn.addEventListener("click", exportExcel);
  importExcelBtn.addEventListener("click", () => excelFileInput.click());
  excelFileInput.addEventListener("change", handleExcelImport);
}

function openModal(title, bodyHtml) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
  modalBody.innerHTML = "";
}

function render() {
  const meta = viewMeta[state.view];
  pageTitle.textContent = meta.title;
  pageDesc.textContent = meta.desc;

  const data = getYearData(state.year);

  if (state.view === "dashboard") {
    viewRoot.innerHTML = renderDashboard(data);
  } else if (state.view === "orders") {
    viewRoot.innerHTML = renderOrders(data);
  } else if (state.view === "sales") {
    viewRoot.innerHTML = renderSales(data);
  } else if (state.view === "payments") {
    viewRoot.innerHTML = renderPayments(data);
  }

  bindDynamicEvents();
}

function getYearData(year) {
  return {
    orders: normalizeBucket(DB.orders?.[year]),
    sales: normalizeBucket(DB.sales?.[year]),
    payments: normalizeBucket(DB.payments?.[year])
  };
}

function normalizeBucket(bucket) {
  return {
    monthly: Array.isArray(bucket?.monthly) ? bucket.monthly : [],
    details: Array.isArray(bucket?.details) ? bucket.details : []
  };
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value).replace(/,/g, "").replace(/원/g, "").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return `${safeNumber(value).toLocaleString("ko-KR")}원`;
}

function formatShortMoney(value) {
  const n = safeNumber(value);
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatDateYYMMDD(value) {
  if (value === null || value === undefined || value === "") return "-";
  const str = String(value);
  const digits = str.replace(/\D/g, "");
  if (digits.length === 6) {
    return `20${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  }
  return str;
}

function sum(list, key) {
  return list.reduce((acc, row) => acc + safeNumber(row?.[key]), 0);
}

function countRealDetails(list, type) {
  return list.filter((row) => {
    if (type === "orders" || type === "sales") {
      const pj = String(row?.pjNo ?? "").trim().toUpperCase();
      return pj && pj !== "TOTAL";
    }
    return true;
  }).length;
}

function matchesQuery(row) {
  if (!state.query) return true;
  const values = Object.values(row || {}).map((v) => String(v ?? "").toLowerCase());
  return values.some((v) => v.includes(state.query));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function orderMonthlySummary(monthly) {
  return {
    total: sum(monthly, "finalOrder"),
    outsourcing: sum(monthly, "outsourcing"),
    concost: sum(monthly, "concost"),
    count: sum(monthly, "count")
  };
}

function salesMonthlySummary(monthly) {
  const total =
    sum(monthly, "total") ||
    sum(monthly, "salesTotal") ||
    sum(monthly, "amount") ||
    sum(monthly, "vatIncluded") ||
    sum(monthly, "invoiceAmount");

  const concost =
    sum(monthly, "concost") ||
    sum(monthly, "concostSales") ||
    sum(monthly, "net") ||
    0;

  return { total, concost };
}

function paymentMonthlySummary(monthly) {
  const claim =
    sum(monthly, "claimAmount") ||
    sum(monthly, "expectedAmount") ||
    sum(monthly, "total") ||
    0;

  const received =
    sum(monthly, "receivedAmount") ||
    sum(monthly, "received") ||
    sum(monthly, "paid") ||
    0;

  return { claim, received };
}

function getTopMonthlyRows(rows, amountKey, limit = 5) {
  return [...rows]
    .map((row) => ({ ...row, __amount: safeNumber(row?.[amountKey]) }))
    .sort((a, b) => b.__amount - a.__amount)
    .slice(0, limit);
}

function buildDashboardKpis(data) {
  const order = orderMonthlySummary(data.orders.monthly);
  const sales = salesMonthlySummary(data.sales.monthly);
  const payments = paymentMonthlySummary(data.payments.monthly);

  return `
    <section class="grid kpi-grid">
      <article class="card kpi-card">
        <div class="kpi-label">연간 최종 수주액</div>
        <div class="kpi-value">${formatMoney(order.total)}</div>
        <div class="kpi-sub">프로젝트 ${countRealDetails(data.orders.details, "orders")}건 / 외주 ${formatMoney(order.outsourcing)}</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">연간 컨코스트 수주 실적</div>
        <div class="kpi-value">${formatMoney(order.concost)}</div>
        <div class="kpi-sub">최종 수주 기준 내부 실적 합계</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">연간 매출 합계</div>
        <div class="kpi-value">${formatMoney(sales.total)}</div>
        <div class="kpi-sub">컨코스트 반영 ${formatMoney(sales.concost)}</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">연간 입금 현황</div>
        <div class="kpi-value">${formatMoney(payments.received)}</div>
        <div class="kpi-sub">청구 대비 ${formatMoney(payments.claim)} 기준</div>
      </article>
    </section>
  `;
}

function renderDashboard(data) {
  const orderSummary = orderMonthlySummary(data.orders.monthly);
  const paymentSummary = paymentMonthlySummary(data.payments.monthly);

  const orderTop = getTopMonthlyRows(data.orders.monthly, "finalOrder", 5);
  const salesTop = getTopMonthlyRows(
    data.sales.monthly,
    data.sales.monthly.some((x) => x?.total !== undefined) ? "total" : "concost",
    5
  );
  const recentOrderRows = data.orders.details.filter(matchesQuery).slice(0, 5);
  const recentSalesRows = data.sales.details.filter(matchesQuery).slice(0, 5);
  const recentPaymentRows = data.payments.details.filter(matchesQuery).slice(0, 5);

  const orderRate = orderSummary.total > 0 ? (orderSummary.concost / orderSummary.total) * 100 : 0;
  const paymentRate = paymentSummary.claim > 0 ? (paymentSummary.received / paymentSummary.claim) * 100 : 0;

  return `
    ${buildDashboardKpis(data)}

    <section class="grid split-grid">
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">핵심 비율 현황</h3>
            <div class="card-desc">실무 검토용 핵심 비율</div>
          </div>
          <span class="badge orange">${escapeHtml(state.year)}년 기준</span>
        </div>
        <div class="mini-summary">
          <div class="summary-row">
            <div class="summary-top">
              <span class="summary-label">컨코스트 수주 비중</span>
              <span class="summary-value">${orderRate.toFixed(1)}%</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.min(orderRate, 100)}%"></div></div>
          </div>
          <div class="summary-row">
            <div class="summary-top">
              <span class="summary-label">입금 회수율</span>
              <span class="summary-value">${paymentRate.toFixed(1)}%</span>
            </div>
            <div class="bar-track"><div class="bar-fill green" style="width:${Math.min(paymentRate, 100)}%"></div></div>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">운영 포인트</h3>
            <div class="card-desc">편집과 엑셀 작업이 바로 가능하도록 구성</div>
          </div>
        </div>
        <div class="info-list">
          <div class="info-item">
            <strong>바로 편집</strong>
            <p>수주, 매출, 입금 상세 데이터는 추가, 수정, 삭제가 즉시 가능합니다.</p>
          </div>
          <div class="info-item">
            <strong>엑셀 내보내기</strong>
            <p>현재 화면 기준으로 엑셀 파일을 내려받을 수 있습니다.</p>
          </div>
          <div class="info-item">
            <strong>엑셀 들여오기</strong>
            <p>엑셀의 첫 번째 시트를 현재 탭의 상세 데이터로 반영합니다.</p>
          </div>
        </div>
      </article>
    </section>

    <section class="grid half-grid">
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">월별 수주 상위 구간</h3>
            <div class="card-desc">최종수주액 기준</div>
          </div>
        </div>
        ${renderProgressList(orderTop, "finalOrder", "orange")}
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">월별 매출 상위 구간</h3>
            <div class="card-desc">매출 합계 기준</div>
          </div>
        </div>
        ${renderProgressList(salesTop, "total", "blue")}
      </article>
    </section>

    <section class="grid">
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">최근 검토용 프로젝트 요약</h3>
            <div class="card-desc">검색 조건 반영</div>
          </div>
        </div>
        <div class="grid half-grid">
          <div>
            <div class="card-desc" style="margin-bottom:10px;">수주</div>
            ${renderSimpleList(recentOrderRows, "orders")}
          </div>
          <div>
            <div class="card-desc" style="margin-bottom:10px;">매출</div>
            ${renderSimpleList(recentSalesRows, "sales")}
          </div>
        </div>
        <div style="height:14px;"></div>
        <div>
          <div class="card-desc" style="margin-bottom:10px;">입금</div>
          ${renderSimpleList(recentPaymentRows, "payments")}
        </div>
      </article>
    </section>
  `;
}

function renderProgressList(rows, key, theme = "orange") {
  if (!rows.length) return `<div class="empty">표시할 데이터가 없습니다.</div>`;
  const maxValue = Math.max(...rows.map((row) => safeNumber(row?.[key])), 1);

  return `
    <div class="mini-summary">
      ${rows.map((row) => {
        const value = safeNumber(row?.[key]);
        const width = Math.max((value / maxValue) * 100, 4);
        return `
          <div class="summary-row">
            <div class="summary-top">
              <span class="summary-label">${escapeHtml(row.month || "-")}</span>
              <span class="summary-value">${formatMoney(value)}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill ${theme === "blue" ? "blue" : theme === "green" ? "green" : ""}" style="width:${width}%"></div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderSimpleList(rows, type) {
  if (!rows.length) return `<div class="empty">검색 조건에 맞는 데이터가 없습니다.</div>`;

  return `
    <div class="info-list">
      ${rows.map((row) => {
        if (type === "orders") {
          return `
            <div class="info-item">
              <strong>${escapeHtml(row.project || "-")}</strong>
              <p>${escapeHtml(row.company || "-")} · ${escapeHtml(String(row.pjNo || "-"))} · ${formatMoney(row.finalOrder)}</p>
            </div>
          `;
        }
        if (type === "sales") {
          const value = row.total ?? row.salesTotal ?? row.vatIncluded ?? row.invoiceAmount ?? row.concost ?? 0;
          return `
            <div class="info-item">
              <strong>${escapeHtml(row.project || "-")}</strong>
              <p>${escapeHtml(row.company || "-")} · ${escapeHtml(String(row.pjNo || "-"))} · ${formatMoney(value)}</p>
            </div>
          `;
        }
        const value = row.receivedAmount ?? row.received ?? row.paid ?? row.claimAmount ?? row.expectedAmount ?? row.total ?? 0;
        return `
          <div class="info-item">
            <strong>${escapeHtml(row.project || "-")}</strong>
            <p>${escapeHtml(row.company || "-")} · ${escapeHtml(String(row.no || "-"))} · ${formatMoney(value)}</p>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderOrders(data) {
  const rows = data.orders.details.filter(matchesQuery);
  const summary = orderMonthlySummary(data.orders.monthly);

  return `
    <section class="grid kpi-grid">
      <article class="card kpi-card">
        <div class="kpi-label">총 최종 수주액</div>
        <div class="kpi-value">${formatMoney(summary.total)}</div>
        <div class="kpi-sub">연간 합계</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">외주 금액</div>
        <div class="kpi-value">${formatMoney(summary.outsourcing)}</div>
        <div class="kpi-sub">기전/외주 포함</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">컨코스트 실적</div>
        <div class="kpi-value">${formatMoney(summary.concost)}</div>
        <div class="kpi-sub">내부 반영 기준</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">프로젝트 건수</div>
        <div class="kpi-value">${countRealDetails(data.orders.details, "orders").toLocaleString("ko-KR")}건</div>
        <div class="kpi-sub">TOTAL 제외</div>
      </article>
    </section>

    <section class="section-stack">
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">월별 수주 요약</h3>
            <div class="card-desc">월별 비교표</div>
          </div>
        </div>
        ${renderOrdersMonthlyTable(data.orders.monthly)}
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">수주 프로젝트 상세</h3>
            <div class="card-desc">직접 편집 가능</div>
          </div>
          <div class="tool-row">
            <button class="primary-btn" data-action="add-row" data-type="orders">수주 추가</button>
          </div>
        </div>
        ${renderOrdersDetailTable(rows)}
      </article>
    </section>
  `;
}

function renderSales(data) {
  const rows = data.sales.details.filter(matchesQuery);
  const summary = salesMonthlySummary(data.sales.monthly);

  return `
    <section class="grid kpi-grid">
      <article class="card kpi-card">
        <div class="kpi-label">총 매출 합계</div>
        <div class="kpi-value">${formatMoney(summary.total)}</div>
        <div class="kpi-sub">연간 합계</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">컨코스트 실적</div>
        <div class="kpi-value">${formatMoney(summary.concost)}</div>
        <div class="kpi-sub">월별 실적 합계</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">매출 프로젝트 건수</div>
        <div class="kpi-value">${countRealDetails(data.sales.details, "sales").toLocaleString("ko-KR")}건</div>
        <div class="kpi-sub">TOTAL 제외</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">평균 프로젝트 매출</div>
        <div class="kpi-value">${
          countRealDetails(data.sales.details, "sales") > 0
            ? formatShortMoney(summary.total / countRealDetails(data.sales.details, "sales"))
            : "0원"
        }</div>
        <div class="kpi-sub">단순 평균값</div>
      </article>
    </section>

    <section class="section-stack">
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">월별 매출 요약</h3>
            <div class="card-desc">월별 비교표</div>
          </div>
        </div>
        ${renderSalesMonthlyTable(data.sales.monthly)}
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">매출 프로젝트 상세</h3>
            <div class="card-desc">직접 편집 가능</div>
          </div>
          <div class="tool-row">
            <button class="primary-btn" data-action="add-row" data-type="sales">매출 추가</button>
          </div>
        </div>
        ${renderSalesDetailTable(rows)}
      </article>
    </section>
  `;
}

function renderPayments(data) {
  const rows = data.payments.details.filter(matchesQuery);
  const summary = paymentMonthlySummary(data.payments.monthly);

  return `
    <section class="grid kpi-grid">
      <article class="card kpi-card">
        <div class="kpi-label">청구/예정 금액</div>
        <div class="kpi-value">${formatMoney(summary.claim)}</div>
        <div class="kpi-sub">월별 합계 기준</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">기수령 금액</div>
        <div class="kpi-value">${formatMoney(summary.received)}</div>
        <div class="kpi-sub">실제 입금 합계</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">입금 회수율</div>
        <div class="kpi-value">${summary.claim > 0 ? `${((summary.received / summary.claim) * 100).toFixed(1)}%` : "0.0%"}</div>
        <div class="kpi-sub">기수령 ÷ 청구예정</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">입금 프로젝트 건수</div>
        <div class="kpi-value">${countRealDetails(data.payments.details, "payments").toLocaleString("ko-KR")}건</div>
        <div class="kpi-sub">상세 기준</div>
      </article>
    </section>

    <section class="section-stack">
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">월별 입금 요약</h3>
            <div class="card-desc">월별 비교표</div>
          </div>
        </div>
        ${renderPaymentsMonthlyTable(data.payments.monthly)}
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">입금 프로젝트 상세</h3>
            <div class="card-desc">직접 편집 가능</div>
          </div>
          <div class="tool-row">
            <button class="primary-btn" data-action="add-row" data-type="payments">입금 추가</button>
          </div>
        </div>
        ${renderPaymentsDetailTable(rows)}
      </article>
    </section>
  `;
}

function renderOrdersMonthlyTable(rows) {
  if (!rows.length) return `<div class="empty">표시할 월별 수주 데이터가 없습니다.</div>`;

  return `
    <div class="table-shell">
      <table class="table">
        <thead>
          <tr>
            <th>월</th>
            <th class="t-right">건수</th>
            <th class="t-right">수주액</th>
            <th class="t-right">조정금액</th>
            <th class="t-right">최종수주액</th>
            <th class="t-right">외주</th>
            <th class="t-right">컨코스트</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.month || "-")}</td>
              <td class="t-right">${safeNumber(row.count).toLocaleString("ko-KR")}</td>
              <td class="t-right">${formatMoney(row.orderAmount)}</td>
              <td class="t-right">${formatMoney(row.adjustment)}</td>
              <td class="t-right">${formatMoney(row.finalOrder)}</td>
              <td class="t-right">${formatMoney(row.outsourcing)}</td>
              <td class="t-right">${formatMoney(row.concost)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderOrdersDetailTable(rows) {
  if (!rows.length) return `<div class="empty">검색 조건에 맞는 수주 데이터가 없습니다.</div>`;

  return `
    <div class="table-shell">
      <table class="table">
        <thead>
          <tr>
            <th>월</th>
            <th>PJ No</th>
            <th>수주일</th>
            <th>업체명</th>
            <th>프로젝트명</th>
            <th>구분</th>
            <th class="t-right">최종수주액</th>
            <th class="t-right">외주</th>
            <th class="t-right">컨코스트</th>
            <th>비고</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, idx) => `
            <tr>
              <td>${escapeHtml(row.month || "-")}</td>
              <td><span class="project-chip">${escapeHtml(String(row.pjNo ?? "-"))}</span></td>
              <td>${escapeHtml(formatDateYYMMDD(row.orderDate))}</td>
              <td>${escapeHtml(row.company || "-")}</td>
              <td>${escapeHtml(row.project || "-")}</td>
              <td>${escapeHtml(row.category || "-")}</td>
              <td class="t-right">${formatMoney(row.finalOrder)}</td>
              <td class="t-right">${formatMoney(row.outsourcing)}</td>
              <td class="t-right">${formatMoney(row.concost)}</td>
              <td class="muted">${escapeHtml(row.note || "-")}</td>
              <td>
                <button class="action-btn edit" data-action="edit-row" data-type="orders" data-index="${idx}">수정</button>
                <button class="action-btn delete" data-action="delete-row" data-type="orders" data-index="${idx}">삭제</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSalesMonthlyTable(rows) {
  if (!rows.length) return `<div class="empty">표시할 월별 매출 데이터가 없습니다.</div>`;

  return `
    <div class="table-shell">
      <table class="table">
        <thead>
          <tr>
            <th>월</th>
            <th class="t-right">건수</th>
            <th class="t-right">매출합계</th>
            <th class="t-right">컨코스트</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const total = row.total ?? row.salesTotal ?? row.vatIncluded ?? row.invoiceAmount ?? row.amount ?? 0;
            const concost = row.concost ?? row.concostSales ?? row.net ?? 0;
            return `
              <tr>
                <td>${escapeHtml(row.month || "-")}</td>
                <td class="t-right">${safeNumber(row.count).toLocaleString("ko-KR")}</td>
                <td class="t-right">${formatMoney(total)}</td>
                <td class="t-right">${formatMoney(concost)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSalesDetailTable(rows) {
  if (!rows.length) return `<div class="empty">검색 조건에 맞는 매출 데이터가 없습니다.</div>`;

  return `
    <div class="table-shell">
      <table class="table">
        <thead>
          <tr>
            <th>월</th>
            <th>PJ No</th>
            <th>발행일</th>
            <th>업체명</th>
            <th>프로젝트명</th>
            <th class="t-right">매출합계</th>
            <th class="t-right">컨코스트</th>
            <th>비고</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, idx) => {
            const total = row.total ?? row.salesTotal ?? row.vatIncluded ?? row.invoiceAmount ?? row.amount ?? 0;
            const concost = row.concost ?? row.concostSales ?? row.net ?? 0;
            const issueDate = row.issueDate ?? row.salesDate ?? row.date ?? null;

            return `
              <tr>
                <td>${escapeHtml(row.month || "-")}</td>
                <td><span class="project-chip">${escapeHtml(String(row.pjNo ?? "-"))}</span></td>
                <td>${escapeHtml(formatDateYYMMDD(issueDate))}</td>
                <td>${escapeHtml(row.company || "-")}</td>
                <td>${escapeHtml(row.project || "-")}</td>
                <td class="t-right">${formatMoney(total)}</td>
                <td class="t-right">${formatMoney(concost)}</td>
                <td class="muted">${escapeHtml(row.note || "-")}</td>
                <td>
                  <button class="action-btn edit" data-action="edit-row" data-type="sales" data-index="${idx}">수정</button>
                  <button class="action-btn delete" data-action="delete-row" data-type="sales" data-index="${idx}">삭제</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPaymentsMonthlyTable(rows) {
  if (!rows.length) return `<div class="empty">표시할 월별 입금 데이터가 없습니다.</div>`;

  return `
    <div class="table-shell">
      <table class="table">
        <thead>
          <tr>
            <th>월</th>
            <th class="t-right">청구/예정 금액</th>
            <th class="t-right">기수령액</th>
            <th class="t-right">잔액</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const claim = row.claimAmount ?? row.expectedAmount ?? row.total ?? 0;
            const received = row.receivedAmount ?? row.received ?? row.paid ?? 0;
            const balance = safeNumber(claim) - safeNumber(received);
            return `
              <tr>
                <td>${escapeHtml(row.month || "-")}</td>
                <td class="t-right">${formatMoney(claim)}</td>
                <td class="t-right">${formatMoney(received)}</td>
                <td class="t-right">${formatMoney(balance)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPaymentsDetailTable(rows) {
  if (!rows.length) return `<div class="empty">검색 조건에 맞는 입금 데이터가 없습니다.</div>`;

  return `
    <div class="table-shell">
      <table class="table">
        <thead>
          <tr>
            <th>월</th>
            <th>No</th>
            <th>업체명</th>
            <th>프로젝트명</th>
            <th>기성담당자</th>
            <th>지급예상일</th>
            <th class="t-right">청구/예정 금액</th>
            <th class="t-right">기수령액</th>
            <th>비고</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, idx) => {
            const claim = row.claimAmount ?? row.expectedAmount ?? row.total ?? 0;
            const received = row.receivedAmount ?? row.received ?? row.paid ?? 0;
            const manager = row.manager ?? row.pic ?? row.personInCharge ?? row.staff ?? "-";
            const expectedDate = row.expectedDate ?? row.expectedPayment ?? row.paymentDate ?? row.receiveDate ?? row.date ?? null;

            return `
              <tr>
                <td>${escapeHtml(row.month || "-")}</td>
                <td><span class="project-chip">${escapeHtml(String(row.no ?? "-"))}</span></td>
                <td>${escapeHtml(row.company || "-")}</td>
                <td>${escapeHtml(row.project || "-")}</td>
                <td>${escapeHtml(manager)}</td>
                <td>${escapeHtml(formatDateYYMMDD(expectedDate))}</td>
                <td class="t-right">${formatMoney(claim)}</td>
                <td class="t-right">${formatMoney(received)}</td>
                <td class="muted">${escapeHtml(row.note || "-")}</td>
                <td>
                  <button class="action-btn edit" data-action="edit-row" data-type="payments" data-index="${idx}">수정</button>
                  <button class="action-btn delete" data-action="delete-row" data-type="payments" data-index="${idx}">삭제</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function bindDynamicEvents() {
  document.querySelectorAll("[data-action='add-row']").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.type));
  });

  document.querySelectorAll("[data-action='edit-row']").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.type, Number(btn.dataset.index)));
  });

  document.querySelectorAll("[data-action='delete-row']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const index = Number(btn.dataset.index);
      deleteRow(type, index);
    });
  });
}

function getFilteredRows(type) {
  const source = getYearData(state.year)[type].details;
  return source.filter(matchesQuery);
}

function resolveRealIndex(type, filteredIndex) {
  const source = getYearData(state.year)[type].details;
  const filteredRows = source.filter(matchesQuery);
  const target = filteredRows[filteredIndex];
  return source.indexOf(target);
}

function deleteRow(type, filteredIndex) {
  if (!confirm("해당 데이터를 삭제하시겠습니까?")) return;

  const realIndex = resolveRealIndex(type, filteredIndex);
  if (realIndex < 0) return;

  DB[type][state.year].details.splice(realIndex, 1);
  rebuildMonthly(type, state.year);
  saveDB();
  render();
}

function openEditModal(type, filteredIndex = null) {
  const realIndex = filteredIndex === null ? null : resolveRealIndex(type, filteredIndex);
  const row = realIndex === null ? null : DB[type][state.year].details[realIndex];

  const html = buildFormHtml(type, row);
  openModal(`${getTypeLabel(type)} ${row ? "수정" : "추가"}`, html);

  document.getElementById("saveModalBtn").addEventListener("click", () => {
    saveModalForm(type, realIndex);
  });

  document.getElementById("cancelModalBtn").addEventListener("click", closeModal);
}

function getTypeLabel(type) {
  if (type === "orders") return "수주";
  if (type === "sales") return "매출";
  return "입금";
}

function buildFormHtml(type, row) {
  if (type === "orders") {
    return `
      <div class="form-grid">
        <div class="form-field"><label>월</label><input id="f_month" value="${escapeHtml(row?.month || "1월")}" /></div>
        <div class="form-field"><label>PJ No</label><input id="f_pjNo" value="${escapeHtml(row?.pjNo || "")}" /></div>
        <div class="form-field"><label>수주일(YYMMDD)</label><input id="f_orderDate" value="${escapeHtml(row?.orderDate || "")}" /></div>
        <div class="form-field"><label>업체명</label><input id="f_company" value="${escapeHtml(row?.company || "")}" /></div>
        <div class="form-field full"><label>프로젝트명</label><input id="f_project" value="${escapeHtml(row?.project || "")}" /></div>
        <div class="form-field"><label>구분</label><input id="f_category" value="${escapeHtml(row?.category || "")}" /></div>
        <div class="form-field"><label>수주액</label><input id="f_orderAmount" value="${escapeHtml(row?.orderAmount ?? 0)}" /></div>
        <div class="form-field"><label>조정금액</label><input id="f_adjustment" value="${escapeHtml(row?.adjustment ?? 0)}" /></div>
        <div class="form-field"><label>최종수주액</label><input id="f_finalOrder" value="${escapeHtml(row?.finalOrder ?? 0)}" /></div>
        <div class="form-field"><label>외주</label><input id="f_outsourcing" value="${escapeHtml(row?.outsourcing ?? 0)}" /></div>
        <div class="form-field"><label>컨코스트</label><input id="f_concost" value="${escapeHtml(row?.concost ?? 0)}" /></div>
        <div class="form-field full"><label>비고</label><textarea id="f_note">${escapeHtml(row?.note || "")}</textarea></div>
      </div>
      <div class="modal-actions">
        <button id="cancelModalBtn" class="mini-btn" type="button">취소</button>
        <button id="saveModalBtn" class="primary-btn" type="button">저장</button>
      </div>
    `;
  }

  if (type === "sales") {
    return `
      <div class="form-grid">
        <div class="form-field"><label>월</label><input id="f_month" value="${escapeHtml(row?.month || "1월")}" /></div>
        <div class="form-field"><label>PJ No</label><input id="f_pjNo" value="${escapeHtml(row?.pjNo || "")}" /></div>
        <div class="form-field"><label>발행일(YYMMDD)</label><input id="f_issueDate" value="${escapeHtml(row?.issueDate || "")}" /></div>
        <div class="form-field"><label>업체명</label><input id="f_company" value="${escapeHtml(row?.company || "")}" /></div>
        <div class="form-field full"><label>프로젝트명</label><input id="f_project" value="${escapeHtml(row?.project || "")}" /></div>
        <div class="form-field"><label>매출합계</label><input id="f_total" value="${escapeHtml(row?.total ?? 0)}" /></div>
        <div class="form-field"><label>컨코스트</label><input id="f_concost" value="${escapeHtml(row?.concost ?? 0)}" /></div>
        <div class="form-field full"><label>비고</label><textarea id="f_note">${escapeHtml(row?.note || "")}</textarea></div>
      </div>
      <div class="modal-actions">
        <button id="cancelModalBtn" class="mini-btn" type="button">취소</button>
        <button id="saveModalBtn" class="primary-btn" type="button">저장</button>
      </div>
    `;
  }

  return `
    <div class="form-grid">
      <div class="form-field"><label>월</label><input id="f_month" value="${escapeHtml(row?.month || "1월")}" /></div>
      <div class="form-field"><label>No</label><input id="f_no" value="${escapeHtml(row?.no || "")}" /></div>
      <div class="form-field"><label>업체명</label><input id="f_company" value="${escapeHtml(row?.company || "")}" /></div>
      <div class="form-field"><label>프로젝트명</label><input id="f_project" value="${escapeHtml(row?.project || "")}" /></div>
      <div class="form-field"><label>기성담당자</label><input id="f_manager" value="${escapeHtml(row?.manager || "")}" /></div>
      <div class="form-field"><label>지급예상일</label><input id="f_expectedPayment" value="${escapeHtml(row?.expectedPayment || row?.expectedDate || "")}" /></div>
      <div class="form-field"><label>청구/예정 금액</label><input id="f_total" value="${escapeHtml(row?.total ?? row?.claimAmount ?? row?.expectedAmount ?? 0)}" /></div>
      <div class="form-field"><label>기수령액</label><input id="f_received" value="${escapeHtml(row?.received ?? row?.receivedAmount ?? 0)}" /></div>
      <div class="form-field"><label>청구금액(VAT제외)</label><input id="f_billingExVat" value="${escapeHtml(row?.billingExVat ?? 0)}" /></div>
      <div class="form-field"><label>청구금액(VAT포함)</label><input id="f_billingIncVat" value="${escapeHtml(row?.billingIncVat ?? 0)}" /></div>
      <div class="form-field"><label>외주</label><input id="f_outsourcing" value="${escapeHtml(row?.outsourcing ?? 0)}" /></div>
      <div class="form-field"><label>발행일</label><input id="f_issueDate" value="${escapeHtml(row?.issueDate || "")}" /></div>
      <div class="form-field full"><label>비고</label><textarea id="f_note">${escapeHtml(row?.note || "")}</textarea></div>
    </div>
    <div class="modal-actions">
      <button id="cancelModalBtn" class="mini-btn" type="button">취소</button>
      <button id="saveModalBtn" class="primary-btn" type="button">저장</button>
    </div>
  `;
}

function saveModalForm(type, realIndex) {
  let row;

  if (type === "orders") {
    row = {
      month: document.getElementById("f_month").value.trim(),
      pjNo: document.getElementById("f_pjNo").value.trim(),
      orderDate: document.getElementById("f_orderDate").value.trim(),
      company: document.getElementById("f_company").value.trim(),
      project: document.getElementById("f_project").value.trim(),
      category: document.getElementById("f_category").value.trim(),
      orderAmount: safeNumber(document.getElementById("f_orderAmount").value),
      adjustment: safeNumber(document.getElementById("f_adjustment").value),
      finalOrder: safeNumber(document.getElementById("f_finalOrder").value),
      outsourcing: safeNumber(document.getElementById("f_outsourcing").value),
      concost: safeNumber(document.getElementById("f_concost").value),
      note: document.getElementById("f_note").value.trim() || null
    };
  } else if (type === "sales") {
    row = {
      month: document.getElementById("f_month").value.trim(),
      pjNo: document.getElementById("f_pjNo").value.trim(),
      issueDate: document.getElementById("f_issueDate").value.trim(),
      company: document.getElementById("f_company").value.trim(),
      project: document.getElementById("f_project").value.trim(),
      total: safeNumber(document.getElementById("f_total").value),
      concost: safeNumber(document.getElementById("f_concost").value),
      note: document.getElementById("f_note").value.trim() || null
    };
  } else {
    row = {
      month: document.getElementById("f_month").value.trim(),
      no: document.getElementById("f_no").value.trim(),
      company: document.getElementById("f_company").value.trim(),
      project: document.getElementById("f_project").value.trim(),
      manager: document.getElementById("f_manager").value.trim(),
      expectedPayment: document.getElementById("f_expectedPayment").value.trim(),
      total: safeNumber(document.getElementById("f_total").value),
      received: safeNumber(document.getElementById("f_received").value),
      billingExVat: safeNumber(document.getElementById("f_billingExVat").value),
      billingIncVat: safeNumber(document.getElementById("f_billingIncVat").value),
      outsourcing: safeNumber(document.getElementById("f_outsourcing").value),
      issueDate: document.getElementById("f_issueDate").value.trim(),
      note: document.getElementById("f_note").value.trim() || null
    };
  }

  if (!DB[type][state.year]) {
    DB[type][state.year] = { monthly: [], details: [] };
  }

  if (realIndex === null || realIndex === undefined) {
    DB[type][state.year].details.push(row);
  } else {
    DB[type][state.year].details[realIndex] = row;
  }

  rebuildMonthly(type, state.year);
  saveDB();
  closeModal();
  render();
}

function rebuildMonthly(type, year) {
  const details = DB[type]?.[year]?.details || [];
  const monthOrder = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

  const grouped = {};
  monthOrder.forEach((m) => grouped[m] = []);

  details.forEach((row) => {
    const month = row.month || "1월";
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(row);
  });

  if (type === "orders") {
    DB[type][year].monthly = monthOrder.map((month) => {
      const rows = grouped[month] || [];
      const realRows = rows.filter((r) => String(r.pjNo || "").toUpperCase() !== "TOTAL");
      return {
        month,
        count: realRows.length,
        orderAmount: sum(rows, "orderAmount"),
        adjustment: sum(rows, "adjustment"),
        finalOrder: sum(rows, "finalOrder"),
        outsourcing: sum(rows, "outsourcing"),
        concost: sum(rows, "concost")
      };
    });
  }

  if (type === "sales") {
    DB[type][year].monthly = monthOrder.map((month) => {
      const rows = grouped[month] || [];
      const realRows = rows.filter((r) => String(r.pjNo || "").toUpperCase() !== "TOTAL");
      return {
        month,
        count: realRows.length,
        total: sum(rows, "total"),
        concost: sum(rows, "concost")
      };
    });
  }

  if (type === "payments") {
    DB[type][year].monthly = monthOrder.map((month) => {
      const rows = grouped[month] || [];
      return {
        month,
        total: sum(rows, "total"),
        received: sum(rows, "received"),
        billingExVat: sum(rows, "billingExVat"),
        billingIncVat: sum(rows, "billingIncVat"),
        balanceAfterBilling: rows.reduce((acc, r) => acc + (safeNumber(r.total) - safeNumber(r.received)), 0),
        outsourcing: sum(rows, "outsourcing"),
        expectedPaymentVat: sum(rows, "billingIncVat")
      };
    });
  }
}

function exportExcel() {
  const wb = XLSX.utils.book_new();

  if (state.view === "dashboard") {
    const yearData = getYearData(state.year);

    const dashboardSheet = XLSX.utils.json_to_sheet([
      {
        구분: "수주",
        연도: state.year,
        합계: orderMonthlySummary(yearData.orders.monthly).total,
        컨코스트: orderMonthlySummary(yearData.orders.monthly).concost,
        외주: orderMonthlySummary(yearData.orders.monthly).outsourcing
      },
      {
        구분: "매출",
        연도: state.year,
        합계: salesMonthlySummary(yearData.sales.monthly).total,
        컨코스트: salesMonthlySummary(yearData.sales.monthly).concost
      },
      {
        구분: "입금",
        연도: state.year,
        청구예정합계: paymentMonthlySummary(yearData.payments.monthly).claim,
        기수령합계: paymentMonthlySummary(yearData.payments.monthly).received
      }
    ]);
    XLSX.utils.book_append_sheet(wb, dashboardSheet, "대시보드요약");

    const ordersMonthly = XLSX.utils.json_to_sheet(yearData.orders.monthly);
    const salesMonthly = XLSX.utils.json_to_sheet(yearData.sales.monthly);
    const paymentsMonthly = XLSX.utils.json_to_sheet(yearData.payments.monthly);

    XLSX.utils.book_append_sheet(wb, ordersMonthly, "수주월별");
    XLSX.utils.book_append_sheet(wb, salesMonthly, "매출월별");
    XLSX.utils.book_append_sheet(wb, paymentsMonthly, "입금월별");
  } else {
    const details = getYearData(state.year)[state.view].details.filter(matchesQuery);
    const sheet = XLSX.utils.json_to_sheet(details);
    XLSX.utils.book_append_sheet(wb, sheet, `${getTypeLabel(state.view)}상세`);
  }

  const fileName = `CONCOST_${viewMeta[state.view].title}_${state.year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function handleExcelImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (state.view === "dashboard") {
    alert("대시보드에서는 들여오기를 하지 않습니다. 수주/매출/입금 탭에서 진행해주세요.");
    excelFileInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target.result;
    const wb = XLSX.read(data, { type: "binary" });
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) {
      alert("엑셀에 데이터가 없습니다.");
      excelFileInput.value = "";
      return;
    }

    if (!confirm(`현재 ${getTypeLabel(state.view)} ${state.year}년 상세 데이터를 엑셀 데이터로 교체하시겠습니까?`)) {
      excelFileInput.value = "";
      return;
    }

    importRowsToCurrentView(rows);
    excelFileInput.value = "";
  };

  reader.readAsBinaryString(file);
}

function importRowsToCurrentView(rows) {
  if (!DB[state.view][state.year]) {
    DB[state.view][state.year] = { monthly: [], details: [] };
  }

  if (state.view === "orders") {
    DB.orders[state.year].details = rows.map((r) => ({
      month: r.month || r.월 || "1월",
      pjNo: r.pjNo || r["PJ No"] || r.PJNo || "",
      orderDate: r.orderDate || r.수주일 || "",
      company: r.company || r.업체명 || "",
      project: r.project || r.프로젝트명 || "",
      category: r.category || r.구분 || "",
      orderAmount: safeNumber(r.orderAmount || r.수주액),
      adjustment: safeNumber(r.adjustment || r.조정금액),
      finalOrder: safeNumber(r.finalOrder || r.최종수주액),
      outsourcing: safeNumber(r.outsourcing || r.외주),
      concost: safeNumber(r.concost || r.컨코스트),
      note: r.note || r.비고 || null
    }));
    rebuildMonthly("orders", state.year);
  }

  if (state.view === "sales") {
    DB.sales[state.year].details = rows.map((r) => ({
      month: r.month || r.월 || "1월",
      pjNo: r.pjNo || r["PJ No"] || r.PJNo || "",
      issueDate: r.issueDate || r.발행일 || "",
      company: r.company || r.업체명 || "",
      project: r.project || r.프로젝트명 || "",
      total: safeNumber(r.total || r.매출합계),
      concost: safeNumber(r.concost || r.컨코스트),
      note: r.note || r.비고 || null
    }));
    rebuildMonthly("sales", state.year);
  }

  if (state.view === "payments") {
    DB.payments[state.year].details = rows.map((r) => ({
      month: r.month || r.월 || "1월",
      no: r.no || r.No || r.NO || "",
      company: r.company || r.업체명 || "",
      project: r.project || r.프로젝트명 || "",
      manager: r.manager || r.기성담당자 || "",
      expectedPayment: r.expectedPayment || r.지급예상일 || "",
      total: safeNumber(r.total || r["청구/예정 금액"] || r.청구예정금액),
      received: safeNumber(r.received || r.기수령액),
      billingExVat: safeNumber(r.billingExVat || r["청구금액(VAT제외)"]),
      billingIncVat: safeNumber(r.billingIncVat || r["청구금액(VAT포함)"]),
      outsourcing: safeNumber(r.outsourcing || r.외주),
      issueDate: r.issueDate || r.발행일 || "",
      note: r.note || r.비고 || null
    }));
    rebuildMonthly("payments", state.year);
  }

  saveDB();
  refreshYearOptions();
  render();
}

function getTypeLabel(type) {
  if (type === "orders") return "수주";
  if (type === "sales") return "매출";
  if (type === "payments") return "입금";
  return "데이터";
}
