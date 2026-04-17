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
    desc: "발행 금액, VAT 포함 금액, 컨코스트 실적을 기준으로 검토합니다."
  },
  payments: {
    title: "입금 관리",
    desc: "청구 예정, 기수령, 지급예상일 기준으로 입금 현황을 관리합니다."
  }
};

const yearSelect = document.getElementById("yearSelect");
const searchInput = document.getElementById("searchInput");
const viewRoot = document.getElementById("viewRoot");
const pageTitle = document.getElementById("pageTitle");
const pageDesc = document.getElementById("pageDesc");

const allYears = Array.from(
  new Set([
    ...Object.keys(SAMPLE_DATA.orders || {}),
    ...Object.keys(SAMPLE_DATA.sales || {}),
    ...Object.keys(SAMPLE_DATA.payments || {})
  ])
).sort((a, b) => Number(b) - Number(a));

state.year = allYears[0] || new Date().getFullYear().toString();

init();

function init() {
  yearSelect.innerHTML = allYears
    .map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}년</option>`)
    .join("");

  yearSelect.value = state.year;

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      state.view = btn.dataset.view;
      render();
    });
  });

  yearSelect.addEventListener("change", (e) => {
    state.year = e.target.value;
    render();
  });

  searchInput.addEventListener("input", (e) => {
    state.query = e.target.value.trim().toLowerCase();
    render();
  });

  render();
}

function render() {
  const meta = viewMeta[state.view];
  pageTitle.textContent = meta.title;
  pageDesc.textContent = meta.desc;

  const data = getYearData(state.year);

  if (state.view === "dashboard") {
    viewRoot.innerHTML = renderDashboard(data);
    return;
  }

  if (state.view === "orders") {
    viewRoot.innerHTML = renderOrders(data);
    return;
  }

  if (state.view === "sales") {
    viewRoot.innerHTML = renderSales(data);
    return;
  }

  if (state.view === "payments") {
    viewRoot.innerHTML = renderPayments(data);
    return;
  }
}

function getYearData(year) {
  return {
    orders: normalizeBucket(SAMPLE_DATA.orders?.[year]),
    sales: normalizeBucket(SAMPLE_DATA.sales?.[year]),
    payments: normalizeBucket(SAMPLE_DATA.payments?.[year])
  };
}

function normalizeBucket(bucket) {
  return {
    monthly: Array.isArray(bucket?.monthly) ? bucket.monthly : [],
    details: Array.isArray(bucket?.details) ? bucket.details : []
  };
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return `${safeNumber(value).toLocaleString("ko-KR")}원`;
}

function formatShortMoney(value) {
  const n = safeNumber(value);

  if (n >= 100000000) {
    return `${(n / 100000000).toFixed(1)}억`;
  }
  if (n >= 10000) {
    return `${Math.round(n / 10000).toLocaleString("ko-KR")}만`;
  }
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatDateYYMMDD(value) {
  if (value === null || value === undefined || value === "") return "-";
  const str = String(value).replace(/\D/g, "");
  if (str.length !== 6) return String(value);
  return `20${str.slice(0, 2)}-${str.slice(2, 4)}-${str.slice(4, 6)}`;
}

function sum(list, key) {
  return list.reduce((acc, row) => acc + safeNumber(row?.[key]), 0);
}

function countRealDetails(list) {
  return list.filter((row) => {
    const pj = String(row?.pjNo ?? "").trim().toUpperCase();
    return pj && pj !== "TOTAL";
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
    .map((row) => ({
      ...row,
      __amount: safeNumber(row?.[amountKey])
    }))
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
        <div class="kpi-sub">프로젝트 ${countRealDetails(data.orders.details)}건 / 외주 ${formatMoney(order.outsourcing)}</div>
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
  const salesSummary = salesMonthlySummary(data.sales.monthly);
  const paymentSummary = paymentMonthlySummary(data.payments.monthly);

  const orderTop = getTopMonthlyRows(data.orders.monthly, "finalOrder", 5);
  const salesTop = getTopMonthlyRows(
    data.sales.monthly,
    data.sales.monthly.some((x) => x?.total !== undefined) ? "total" :
    data.sales.monthly.some((x) => x?.salesTotal !== undefined) ? "salesTotal" :
    data.sales.monthly.some((x) => x?.vatIncluded !== undefined) ? "vatIncluded" :
    data.sales.monthly.some((x) => x?.invoiceAmount !== undefined) ? "invoiceAmount" :
    "concost",
    5
  );
  const paymentTop = getTopMonthlyRows(
    data.payments.monthly,
    data.payments.monthly.some((x) => x?.receivedAmount !== undefined) ? "receivedAmount" :
    data.payments.monthly.some((x) => x?.received !== undefined) ? "received" :
    data.payments.monthly.some((x) => x?.paid !== undefined) ? "paid" :
    "claimAmount",
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
      <article class="card soft">
        <div class="card-head">
          <div>
            <h3 class="card-title">핵심 비율 현황</h3>
            <div class="card-desc">실무 검토 시 가장 많이 보는 핵심 비율만 요약</div>
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

          <div class="summary-row">
            <div class="summary-top">
              <span class="summary-label">연간 수주 건수</span>
              <span class="summary-value">${orderSummary.count.toLocaleString("ko-KR")}건</span>
            </div>
            <div class="bar-track"><div class="bar-fill blue" style="width:${Math.min(orderSummary.count * 10, 100)}%"></div></div>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">운영 포인트</h3>
            <div class="card-desc">GitHub 기반 정적 운영에서 가독성을 우선한 화면 구성</div>
          </div>
        </div>

        <div class="info-list">
          <div class="info-item">
            <strong>1. 상단 KPI 고정</strong>
            <p>연도 변경 시 수주/매출/입금 핵심 금액을 즉시 비교할 수 있게 구성했습니다.</p>
          </div>
          <div class="info-item">
            <strong>2. 탭별 분리</strong>
            <p>수주 / 매출 / 입금을 분리해 실무 검토 흐름이 끊기지 않도록 정리했습니다.</p>
          </div>
          <div class="info-item">
            <strong>3. 검색 통합</strong>
            <p>업체명, 프로젝트명, PJ No를 한 번에 검색할 수 있게 맞췄습니다.</p>
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
          <span class="badge orange">${orderTop.length}개 월</span>
        </div>
        ${renderProgressList(orderTop, "finalOrder", "orange")}
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">월별 매출 상위 구간</h3>
            <div class="card-desc">매출 합계 기준</div>
          </div>
          <span class="badge blue">${salesTop.length}개 월</span>
        </div>
        ${renderProgressList(
          salesTop,
          salesTop[0]?.total !== undefined ? "total" :
          salesTop[0]?.salesTotal !== undefined ? "salesTotal" :
          salesTop[0]?.vatIncluded !== undefined ? "vatIncluded" :
          salesTop[0]?.invoiceAmount !== undefined ? "invoiceAmount" :
          "concost",
          "blue"
        )}
      </article>
    </section>

    <section class="grid">
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">최근 검토용 프로젝트 요약</h3>
            <div class="card-desc">검색 조건 반영 기준으로 각 영역 최신 5건 표시</div>
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
  if (!rows.length) {
    return `<div class="empty">표시할 데이터가 없습니다.</div>`;
  }

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
  if (!rows.length) {
    return `<div class="empty">검색 조건에 맞는 데이터가 없습니다.</div>`;
  }

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
          const value =
            row.total ?? row.salesTotal ?? row.vatIncluded ?? row.invoiceAmount ?? row.concost ?? 0;
          return `
            <div class="info-item">
              <strong>${escapeHtml(row.project || "-")}</strong>
              <p>${escapeHtml(row.company || "-")} · ${escapeHtml(String(row.pjNo || "-"))} · ${formatMoney(value)}</p>
            </div>
          `;
        }

        const value =
          row.receivedAmount ?? row.received ?? row.paid ?? row.claimAmount ?? row.expectedAmount ?? 0;

        return `
          <div class="info-item">
            <strong>${escapeHtml(row.project || "-")}</strong>
            <p>${escapeHtml(row.company || "-")} · ${escapeHtml(String(row.pjNo || "-"))} · ${formatMoney(value)}</p>
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
        <div class="kpi-value">${countRealDetails(data.orders.details).toLocaleString("ko-KR")}건</div>
        <div class="kpi-sub">TOTAL 제외</div>
      </article>
    </section>

    <section class="section-stack">
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">월별 수주 요약</h3>
            <div class="card-desc">최종수주액, 외주, 컨코스트 실적을 월별로 비교</div>
          </div>
          <span class="badge orange">${escapeHtml(state.year)}년</span>
        </div>
        ${renderOrdersMonthlyTable(data.orders.monthly)}
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">수주 프로젝트 상세</h3>
            <div class="card-desc">PJ No, 업체명, 분류, 비고까지 한 번에 검토 가능</div>
          </div>
          <span class="badge orange">${rows.length}건</span>
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
        <div class="kpi-sub">VAT 포함 또는 총액 기준</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">컨코스트 실적</div>
        <div class="kpi-value">${formatMoney(summary.concost)}</div>
        <div class="kpi-sub">월별 실적 합계</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">매출 프로젝트 건수</div>
        <div class="kpi-value">${countRealDetails(data.sales.details).toLocaleString("ko-KR")}건</div>
        <div class="kpi-sub">TOTAL 제외</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">평균 프로젝트 매출</div>
        <div class="kpi-value">${
          countRealDetails(data.sales.details) > 0
            ? formatShortMoney(summary.total / countRealDetails(data.sales.details))
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
            <div class="card-desc">월별 매출액과 컨코스트 실적 비교</div>
          </div>
          <span class="badge blue">${escapeHtml(state.year)}년</span>
        </div>
        ${renderSalesMonthlyTable(data.sales.monthly)}
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">매출 프로젝트 상세</h3>
            <div class="card-desc">발행일자, 업체명, 프로젝트명, 금액 검토용 화면</div>
          </div>
          <span class="badge blue">${rows.length}건</span>
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
        <div class="kpi-value">${
          summary.claim > 0 ? `${((summary.received / summary.claim) * 100).toFixed(1)}%` : "0.0%"
        }</div>
        <div class="kpi-sub">기수령 ÷ 청구예정</div>
      </article>
      <article class="card kpi-card">
        <div class="kpi-label">입금 프로젝트 건수</div>
        <div class="kpi-value">${countRealDetails(data.payments.details).toLocaleString("ko-KR")}건</div>
        <div class="kpi-sub">TOTAL 제외</div>
      </article>
    </section>

    <section class="section-stack">
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">월별 입금 요약</h3>
            <div class="card-desc">청구액, 기수령액, 잔액 흐름을 월별로 확인</div>
          </div>
          <span class="badge green">${escapeHtml(state.year)}년</span>
        </div>
        ${renderPaymentsMonthlyTable(data.payments.monthly)}
      </article>

      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">입금 프로젝트 상세</h3>
            <div class="card-desc">기성담당자, 지급예상일, 수령금액 중심 실무 화면</div>
          </div>
          <span class="badge green">${rows.length}건</span>
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
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
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
            const total =
              row.total ?? row.salesTotal ?? row.vatIncluded ?? row.invoiceAmount ?? row.amount ?? 0;
            const concost =
              row.concost ?? row.concostSales ?? row.net ?? 0;
            const count = row.count ?? 0;

            return `
              <tr>
                <td>${escapeHtml(row.month || "-")}</td>
                <td class="t-right">${safeNumber(count).toLocaleString("ko-KR")}</td>
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
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const total =
              row.total ?? row.salesTotal ?? row.vatIncluded ?? row.invoiceAmount ?? row.amount ?? 0;
            const concost =
              row.concost ?? row.concostSales ?? row.net ?? 0;
            const issueDate =
              row.issueDate ?? row.salesDate ?? row.date ?? null;

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
            <th class="t-right">건수</th>
            <th class="t-right">청구/예정 금액</th>
            <th class="t-right">기수령액</th>
            <th class="t-right">잔액</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const claim =
              row.claimAmount ?? row.expectedAmount ?? row.total ?? 0;
            const received =
              row.receivedAmount ?? row.received ?? row.paid ?? 0;
            const balance = safeNumber(claim) - safeNumber(received);
            const count = row.count ?? 0;

            return `
              <tr>
                <td>${escapeHtml(row.month || "-")}</td>
                <td class="t-right">${safeNumber(count).toLocaleString("ko-KR")}</td>
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
            <th>PJ No</th>
            <th>업체명</th>
            <th>프로젝트명</th>
            <th>기성담당자</th>
            <th>지급예상일</th>
            <th class="t-right">청구/예정 금액</th>
            <th class="t-right">기수령액</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const claim =
              row.claimAmount ?? row.expectedAmount ?? row.total ?? 0;
            const received =
              row.receivedAmount ?? row.received ?? row.paid ?? 0;

            const manager =
              row.manager ?? row.pic ?? row.personInCharge ?? row.staff ?? "-";

            const expectedDate =
              row.expectedDate ?? row.paymentDate ?? row.receiveDate ?? row.date ?? null;

            return `
              <tr>
                <td>${escapeHtml(row.month || "-")}</td>
                <td><span class="project-chip">${escapeHtml(String(row.pjNo ?? "-"))}</span></td>
                <td>${escapeHtml(row.company || "-")}</td>
                <td>${escapeHtml(row.project || "-")}</td>
                <td>${escapeHtml(manager)}</td>
                <td>${escapeHtml(formatDateYYMMDD(expectedDate))}</td>
                <td class="t-right">${formatMoney(claim)}</td>
                <td class="t-right">${formatMoney(received)}</td>
                <td class="muted">${escapeHtml(row.note || "-")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}
