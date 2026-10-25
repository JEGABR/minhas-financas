const STORAGE_KEY = 'minhas_financas_v2_tx';
const USER_NAME_KEY = 'minhas_financas_username';
const CUSTOM_BANKS_KEY = 'minhas_financas_custom_banks';

// Remove dados fictícios antigos caso existam
localStorage.removeItem('finai_transactions');

const MONTH_NAMES = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro'
};

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const BANK_COLORS = {
  'Nubank': '#820ad1',
  'Itaú': '#ec7000',
  'Bradesco': '#cc092f',
  'Banco do Brasil': '#ca8a04',
  'Caixa Econômica': '#005ca9',
  'Santander': '#ec0000',
  'Banco Inter': '#ff7a00',
  'C6 Bank': '#334155',
  'BTG Pactual': '#1e3a8a',
  'PicPay': '#11c76f',
  'Mercado Pago': '#009ee3',
  'Sicredi': '#3f8f29',
  'Sicoob': '#003641',
  'XP Investimentos': '#a16207',
  'Neon': '#00a4ef',
  'PagBank': '#65a30d',
  'Dinheiro / Carteira': '#10b981'
};

let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let customBanks = JSON.parse(localStorage.getItem(CUSTOM_BANKS_KEY)) || [];
let userName = localStorage.getItem(USER_NAME_KEY) || 'Gabriel';
let selectedMonth = '10';
let selectedYear = 2026;
let isInstallmentMode = false;
let lastAgentBatchIds = [];

/**
 * Agente de Lançamento Rápido em Linguagem Natural (Português)
 */
function parseAndExecuteAgentCommand(rawInput) {
  const text = rawInput.trim();
  if (!text) return;

  const lower = text.toLowerCase();

  let installments = 1;
  let isParcelado = false;
  let matchedInstallmentStr = '';

  const parcelRegexes = [
    /(?:parcelad[oa]\s+em\s+|dividid[oa]\s+em\s+|em\s+)?(\d{1,3})\s*(?:vezes|x|parcelas?)\b/i,
    /\bparcelad[oa]\s+em\s+(\d{1,3})\b/i
  ];

  for (const rgx of parcelRegexes) {
    const m = text.match(rgx);
    if (m) {
      installments = Math.max(2, parseInt(m[1], 10));
      isParcelado = true;
      matchedInstallmentStr = m[0];
      break;
    }
  }

  const isParcelValueMode = /(?:\d{1,3})\s*(?:vezes|x|parcelas?)\s+de\s+(?:r\$\s*)?\d/i.test(text);

  let textWithoutInstallments = matchedInstallmentStr
    ? text.replace(matchedInstallmentStr, ' ')
    : text;

  let amount = 0;
  let matchedAmountStr = '';
  const amountMatch = textWithoutInstallments.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);

  if (amountMatch) {
    matchedAmountStr = amountMatch[0];
    let numStr = amountMatch[1];
    if (numStr.includes('.') && numStr.includes(',')) {
      numStr = numStr.replace(/\./g, '').replace(',', '.');
    } else if (numStr.includes(',')) {
      numStr = numStr.replace(',', '.');
    }
    amount = parseFloat(numStr) || 0;
  }

  const bankAliases = [
    { keywords: ['nubank', 'nu'], bank: 'Nubank' },
    { keywords: ['itaú', 'itau'], bank: 'Itaú' },
    { keywords: ['bradesco'], bank: 'Bradesco' },
    { keywords: ['banco do brasil', 'bb'], bank: 'Banco do Brasil' },
    { keywords: ['caixa econômica', 'caixa economica', 'caixa'], bank: 'Caixa Econômica' },
    { keywords: ['santander'], bank: 'Santander' },
    { keywords: ['banco inter', 'inter'], bank: 'Banco Inter' },
    { keywords: ['c6 bank', 'c6'], bank: 'C6 Bank' },
    { keywords: ['btg pactual', 'btg'], bank: 'BTG Pactual' },
    { keywords: ['picpay'], bank: 'PicPay' },
    { keywords: ['mercado pago'], bank: 'Mercado Pago' },
    { keywords: ['sicredi'], bank: 'Sicredi' },
    { keywords: ['sicoob'], bank: 'Sicoob' },
    { keywords: ['xp investimentos', 'xp'], bank: 'XP Investimentos' },
    { keywords: ['neon'], bank: 'Neon' },
    { keywords: ['pagbank', 'pagseguro'], bank: 'PagBank' },
    { keywords: ['dinheiro', 'carteira', 'espécie'], bank: 'Dinheiro / Carteira' }
  ];

  let detectedBank = 'Nubank';
  for (const item of bankAliases) {
    const found = item.keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
    if (found) {
      detectedBank = item.bank;
      break;
    }
  }

  const isIncome = /\b(recebi|sal[áa]rio|ganhei|receita|entrada|freelance|rendimento)\b/i.test(lower);
  const type = isIncome ? 'income' : 'expense';
  let category = 'Compras';

  if (isIncome) {
    category = 'Receita';
  } else if (/\b(mercado|supermercado|ifood|restaurante|lanche|alimenta[çc][ãa]o|padaria|feira|comida)\b/i.test(lower)) {
    category = 'Alimentação';
  } else if (/\b(aluguel|condom[íi]nio|luz|energia|[áa]gua|internet|moradia|casa|g[áa]s|iptu)\b/i.test(lower)) {
    category = 'Moradia';
  } else if (/\b(uber|99|gasolina|combust[íi]vel|transporte|[ôo]nibus|metr[ôo]|carro|ipva|oficina)\b/i.test(lower)) {
    category = 'Transporte';
  } else if (/\b(netflix|spotify|assinatura|mensalidade|cloud|streaming|plano)\b/i.test(lower)) {
    category = 'Assinaturas';
  } else if (/\b(academia|farm[áa]cia|m[ée]dico|sa[úu]de|lazer|cinema|viagem|jogo)\b/i.test(lower)) {
    category = 'Lazer';
  } else if (/\b(curso|faculdade|escola|livro|educa[çc][ãa]o)\b/i.test(lower)) {
    category = 'Educação';
  }

  let cleanDesc = textWithoutInstallments
    .replace(matchedAmountStr, ' ')
    .replace(/\b(coloque|coloca|adicione|adiciona|lan[çc]e|lan[çc]a|registre|registra|comprei|paguei|recebi|essa|esse|esta|este|uma|um|d[íi]vida|conta|gasto|despesa|compra|parcelad[oa]|dividid[oa]|avista|[àa]\s*vista|no\s+valor\s+de|valor\s+de|por|reais|real|r\$|no\s+banco|na\s+conta|no\s+cart[ãa]o|no|na|em|de|do|da|vezes|parcelas?)\b/gi, ' ');

  bankAliases.forEach((b) => {
    b.keywords.forEach((kw) => {
      cleanDesc = cleanDesc.replace(new RegExp(`\\b${kw}\\b`, 'gi'), ' ');
    });
  });

  cleanDesc = cleanDesc.replace(/\s+/g, ' ').trim();
  if (!cleanDesc) {
    cleanDesc = isIncome ? 'Receita' : isParcelado ? 'Dívida Parcelada' : 'Despesa';
  } else {
    cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
  }

  const startMonthNum = selectedMonth === 'all' ? 10 : parseInt(selectedMonth, 10);
  const startYearNum = selectedYear;

  if (amount <= 0) {
    openNewModal();
    document.getElementById('txDescription').value = cleanDesc;
    document.getElementById('txType').value = type;
    document.getElementById('txCategory').value = category;
    document.getElementById('txAccount').value = detectedBank;
    if (isParcelado) {
      document.getElementById('btnModeParcelado').click();
      document.getElementById('txInstallments').value = installments;
      updateInstallmentPreview();
    }
    setTimeout(() => document.getElementById('txAmount').focus(), 50);
    showAgentFeedback(
      `🤖 Preparei o lançamento <strong>"${cleanDesc}"</strong> ${isParcelado ? `parcelado em <strong>${installments}x</strong>` : 'à vista'} (${detectedBank}). Digite apenas o valor em R$ para confirmar!`,
      false
    );
    return;
  }

  lastAgentBatchIds = [];

  if (!isParcelado) {
    const period = addMonthsToPeriod(startYearNum, startMonthNum, 0);
    const id = Date.now();
    lastAgentBatchIds.push(id);
    transactions.push({
      id,
      description: cleanDesc,
      baseDescription: cleanDesc,
      amount: Math.round(amount * 100) / 100,
      type,
      category,
      account: detectedBank,
      year: period.year,
      month: period.month,
      periodKey: period.periodKey,
      isInstallment: false,
      installmentNumber: 1,
      totalInstallments: 1
    });

    saveTransactions();
    refreshDashboard();
    showAgentFeedback(
      `🤖 <strong>Agente:</strong> Lancei <strong>"${cleanDesc}"</strong> à vista no valor de <strong>${formatBRL(amount)}</strong> (${detectedBank} • ${category}) em ${formatPeriodLabel(period.periodKey)}.`,
      true
    );
  } else {
    const parcelAmount = isParcelValueMode
      ? Math.round(amount * 100) / 100
      : Math.round((amount / installments) * 100) / 100;
    const totalAmount = Math.round(parcelAmount * installments * 100) / 100;
    const groupId = `grp_${Date.now()}`;

    for (let i = 0; i < installments; i++) {
      const period = addMonthsToPeriod(startYearNum, startMonthNum, i);
      const id = Date.now() + i;
      lastAgentBatchIds.push(id);
      transactions.push({
        id,
        groupId,
        description: `${cleanDesc} (${i + 1}/${installments})`,
        baseDescription: cleanDesc,
        amount: parcelAmount,
        type,
        category,
        account: detectedBank,
        year: period.year,
        month: period.month,
        periodKey: period.periodKey,
        isInstallment: true,
        installmentNumber: i + 1,
        totalInstallments: installments
      });
    }

    const firstP = addMonthsToPeriod(startYearNum, startMonthNum, 0);
    const lastP = addMonthsToPeriod(startYearNum, startMonthNum, installments - 1);

    saveTransactions();
    refreshDashboard();
    showAgentFeedback(
      `🤖 <strong>Agente:</strong> Lancei <strong>"${cleanDesc}"</strong> parcelado em <strong>${installments}x de ${formatBRL(parcelAmount)}</strong> (Total: ${formatBRL(totalAmount)}) no <strong>${detectedBank}</strong> — de ${formatPeriodLabel(firstP.periodKey)} até ${formatPeriodLabel(lastP.periodKey)}!`,
      true
    );
  }
}

function showAgentFeedback(htmlText, canUndo) {
  const box = document.getElementById('agentFeedback');
  const textEl = document.getElementById('agentFeedbackText');
  const undoBtn = document.getElementById('btnUndoAgent');

  textEl.innerHTML = htmlText;
  box.classList.remove('hidden');
  if (canUndo && lastAgentBatchIds.length > 0) {
    undoBtn.classList.remove('hidden');
  } else {
    undoBtn.classList.add('hidden');
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function saveCustomBanks() {
  localStorage.setItem(CUSTOM_BANKS_KEY, JSON.stringify(customBanks));
}

function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getAllBanks() {
  const base = Object.keys(BANK_COLORS);
  customBanks.forEach((b) => {
    if (!base.includes(b)) base.push(b);
  });
  transactions.forEach((t) => {
    if (t.account && !base.includes(t.account)) base.push(t.account);
  });
  return base;
}

function renderUserName() {
  const cleanName = userName.trim() || 'Usuário';
  document.getElementById('userNameDisplay').textContent = cleanName;
  document.getElementById('userAvatar').textContent = cleanName.charAt(0).toUpperCase();
  document.getElementById('welcomeTitle').textContent = `Olá, ${cleanName} 👋`;
}

function addMonthsToPeriod(startYear, startMonth, offset) {
  const zeroBasedTotal = startYear * 12 + (startMonth - 1) + offset;
  const targetYear = Math.floor(zeroBasedTotal / 12);
  const targetMonthNum = (zeroBasedTotal % 12) + 1;
  const targetMonth = String(targetMonthNum).padStart(2, '0');
  return {
    year: targetYear,
    month: targetMonth,
    periodKey: `${targetYear}-${targetMonth}`
  };
}

function formatPeriodLabel(periodKey) {
  if (!periodKey || !periodKey.includes('-')) return periodKey;
  const [yr, mo] = periodKey.split('-');
  const shortMo = MONTH_SHORT[Number(mo) - 1] || mo;
  return `${shortMo}/${yr}`;
}

function populateYearSelectors() {
  const yearSelect = document.getElementById('yearSelector');
  const tabYearSelect = document.getElementById('tabFilterYear');
  const currentTabYear = tabYearSelect.value || String(selectedYear);

  const txYears = transactions.map((t) => Number(t.year)).filter(Boolean);
  const minYear = Math.min(2025, ...txYears);
  const maxYear = Math.max(2030, selectedYear, ...txYears);

  const options = [];
  for (let y = minYear; y <= maxYear; y++) {
    options.push(`<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`);
  }
  yearSelect.innerHTML = options.join('');

  const tabOptions = [`<option value="all">Todos os anos</option>`];
  for (let y = minYear; y <= maxYear; y++) {
    tabOptions.push(`<option value="${y}">${y}</option>`);
  }
  tabYearSelect.innerHTML = tabOptions.join('');
  tabYearSelect.value = currentTabYear;
}

function populateBankSelectors() {
  const banks = getAllBanks();

  // Filtro de bancos na Visão Geral
  const bankFilter = document.getElementById('bankFilter');
  const currentFilterVal = bankFilter.value || 'all';
  bankFilter.innerHTML =
    `<option value="all">Todos os bancos</option>` +
    banks.map((b) => `<option value="${b}">${b}</option>`).join('');
  if (banks.includes(currentFilterVal) || currentFilterVal === 'all') {
    bankFilter.value = currentFilterVal;
  }

  // Filtro de bancos na Aba Filtros & Contas
  const tabBankFilter = document.getElementById('tabFilterBank');
  const currentTabBankVal = tabBankFilter.value || 'all';
  tabBankFilter.innerHTML =
    `<option value="all">Todos os bancos</option>` +
    banks.map((b) => `<option value="${b}">${b}</option>`).join('');
  if (banks.includes(currentTabBankVal) || currentTabBankVal === 'all') {
    tabBankFilter.value = currentTabBankVal;
  }

  // Select de bancos dentro do Modal
  const txAccount = document.getElementById('txAccount');
  const currentModalVal = txAccount.value;
  txAccount.innerHTML =
    banks.map((b) => `<option value="${b}">${b}</option>`).join('') +
    `<option value="__custom__">+ Editar / Digitar outro banco ou conta...</option>`;
  if (banks.includes(currentModalVal)) {
    txAccount.value = currentModalVal;
  }
}

function getPeriodTransactions() {
  return transactions.filter((t) => {
    const sameYear = Number(t.year) === Number(selectedYear);
    if (!sameYear) return false;
    if (selectedMonth === 'all') return true;
    return t.month === selectedMonth;
  });
}

/**
 * Retorna as transações do período na Visão Geral já com os filtros de Busca, Banco e Categoria aplicados
 */
function getMainFilteredTransactions() {
  const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
  const catFilter = document.getElementById('categoryFilter').value;
  const bankFilter = document.getElementById('bankFilter').value;

  return getPeriodTransactions().filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery) ||
      t.account.toLowerCase().includes(searchQuery);
    const matchesCat = catFilter === 'all' || t.category === catFilter;
    const matchesBank = bankFilter === 'all' || t.account === bankFilter;
    return matchesSearch && matchesCat && matchesBank;
  });
}

function hasActiveMainFilter() {
  const searchQuery = document.getElementById('searchInput').value.trim();
  const catFilter = document.getElementById('categoryFilter').value;
  const bankFilter = document.getElementById('bankFilter').value;
  return searchQuery !== '' || catFilter !== 'all' || bankFilter !== 'all';
}

function calculateSummary(list) {
  const incomeList = list.filter((t) => t.type === 'income');
  const expenseList = list.filter((t) => t.type === 'expense');

  const income = incomeList.reduce((acc, t) => acc + t.amount, 0);
  const expenses = expenseList.reduce((acc, t) => acc + t.amount, 0);
  const netSavings = income - expenses;
  const savingsRate = income > 0 ? Math.round((netSavings / income) * 100) : 0;

  const byCategory = {};
  expenseList.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  return {
    income,
    expenses,
    netSavings,
    savingsRate,
    incomeCount: incomeList.length,
    expenseCount: expenseList.length,
    byCategory
  };
}

function renderKPIs() {
  // Usa a lista filtrada para que Receitas, Despesas e Balanço mostrem exatamente o filtro aplicado!
  const filteredList = getMainFilteredTransactions();
  const { income, expenses, netSavings, savingsRate, incomeCount, expenseCount } = calculateSummary(filteredList);
  const allSummary = calculateSummary(transactions);
  const isFiltered = hasActiveMainFilter();

  document.getElementById('kpiTotalBalance').textContent = formatBRL(allSummary.netSavings);

  document.getElementById('kpiIncomeLabel').textContent = isFiltered ? 'Receitas (Filtro Aplicado)' : 'Receitas no Período';
  document.getElementById('kpiExpensesLabel').textContent = isFiltered ? 'Despesas (Filtro Aplicado)' : 'Despesas no Período';
  document.getElementById('kpiBalanceLabel').textContent = isFiltered ? 'Balanço (Filtro Aplicado)' : 'Balanço do Período';

  document.getElementById('kpiIncome').textContent = formatBRL(income);
  document.getElementById('kpiIncomeCount').textContent = `${incomeCount} entrada(s) ${isFiltered ? 'no filtro' : 'no período'}`;

  document.getElementById('kpiExpenses').textContent = formatBRL(expenses);
  document.getElementById('kpiExpenseSubtext').textContent = `${expenseCount} saída(s) ${isFiltered ? 'no filtro' : 'no período'}`;

  const savingsEl = document.getElementById('kpiSavingsAmount');
  savingsEl.textContent = formatBRL(netSavings);
  savingsEl.className = `kpi-value ${netSavings > 0 ? 'positive-text' : netSavings < 0 ? 'negative-text' : ''}`;
  document.getElementById('kpiSavingsRate').textContent = `Taxa de economia: ${savingsRate}%`;

  const periodName =
    selectedMonth === 'all'
      ? `Todos os meses de ${selectedYear}`
      : `${MONTH_NAMES[selectedMonth]} de ${selectedYear}`;
  document.getElementById('currentPeriodSubtitle').textContent = `Exibindo dados de: ${periodName}`;
}

function renderCashflowChart() {
  const container = document.getElementById('cashflowChart');
  document.getElementById('cashflowChartTitle').textContent = `Fluxo de Caixa Anual (${selectedYear})`;

  const monthlyData = MONTH_SHORT.map((label, idx) => {
    const mCode = String(idx + 1).padStart(2, '0');
    const mList = transactions.filter((t) => Number(t.year) === Number(selectedYear) && t.month === mCode);
    const { income, expenses } = calculateSummary(mList);
    return { label, monthCode: mCode, income, expense: expenses };
  });

  const maxVal = Math.max(...monthlyData.flatMap((d) => [d.income, d.expense]), 100);

  container.innerHTML = monthlyData
    .map((item) => {
      const incHeight = item.income > 0 ? Math.max(6, Math.round((item.income / maxVal) * 160)) : 3;
      const expHeight = item.expense > 0 ? Math.max(6, Math.round((item.expense / maxVal) * 160)) : 3;
      const isActive = selectedMonth === item.monthCode ? 'active-month' : '';

      return `
        <div class="bar-group ${isActive}" data-select-month="${item.monthCode}" title="Clique para ver ${MONTH_NAMES[item.monthCode]}/${selectedYear}">
          <div class="bars-pair">
            <div class="bar bar-income" style="height: ${incHeight}px" title="Receitas ${item.label}/${selectedYear}: ${formatBRL(item.income)}"></div>
            <div class="bar bar-expense" style="height: ${expHeight}px" title="Despesas ${item.label}/${selectedYear}: ${formatBRL(item.expense)}"></div>
          </div>
          <span class="bar-label">${item.label}</span>
        </div>
      `;
    })
    .join('');
}

function renderCategoryBreakdown() {
  const container = document.getElementById('categoryBreakdown');
  const filteredList = getMainFilteredTransactions();
  const { expenses, byCategory } = calculateSummary(filteredList);

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const colors = ['fill-indigo', 'fill-emerald', 'fill-amber', 'fill-danger'];

  if (entries.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma despesa registrada neste período/filtro (R$ 0,00).</p>`;
    return;
  }

  container.innerHTML = entries
    .map(([cat, amount], idx) => {
      const pct = expenses > 0 ? Math.round((amount / expenses) * 100) : 0;
      const colorClass = colors[idx % colors.length];
      return `
        <div class="category-row">
          <div class="category-row-top">
            <span class="category-name">${cat} (${pct}%)</span>
            <span class="category-amount">${formatBRL(amount)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${colorClass}" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function createTransactionCardHTML(tx) {
  const isIncome = tx.type === 'income';
  const bankColor = BANK_COLORS[tx.account] || '#6366f1';
  const pct = tx.isInstallment
    ? Math.round((tx.installmentNumber / tx.totalInstallments) * 100)
    : 100;

  const modalityBadge = tx.isInstallment
    ? `<span class="badge-installment">Parcela ${tx.installmentNumber}/${tx.totalInstallments} (${pct}%)</span>`
    : `<span class="badge-avista">À vista</span>`;

  const barColorClass = isIncome
    ? 'fill-emerald'
    : tx.isInstallment
    ? 'fill-indigo'
    : 'fill-amber';

  return `
    <div class="tx-card">
      <div class="tx-card-top">
        <div class="tx-card-main">
          <span class="tx-card-title">${tx.description}</span>
          ${modalityBadge}
          <span class="badge-category">${tx.category}</span>
          <span class="badge-bank" style="background: ${bankColor}">${tx.account}</span>
          <span class="tx-card-meta">• ${formatPeriodLabel(tx.periodKey)}</span>
        </div>
        <div class="tx-card-right">
          <span class="tx-card-amount ${isIncome ? 'positive-text' : 'negative-text'}">
            ${isIncome ? '+' : '-'} ${formatBRL(tx.amount)}
          </span>
          <div class="tx-card-actions">
            <button type="button" class="btn-action" data-edit-id="${tx.id}" title="Editar conta / transação">✏️ Editar</button>
            <button type="button" class="btn-action delete" data-delete-id="${tx.id}" title="Excluir">🗑️</button>
          </div>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${barColorClass}" style="width: ${pct}%"></div>
      </div>
    </div>
  `;
}

function renderInstallmentsSummary() {
  const container = document.getElementById('installmentsSummaryList');
  const periodList = getMainFilteredTransactions()
    .filter((t) => t.isInstallment)
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey) || b.id - a.id);

  if (periodList.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma parcela ativa neste período/filtro (R$ 0,00).</p>`;
    return;
  }

  container.innerHTML = periodList.map(createTransactionCardHTML).join('');
}

function renderTransactionsList() {
  const container = document.getElementById('transactionsListContainer');
  const filtered = getMainFilteredTransactions().sort(
    (a, b) => b.periodKey.localeCompare(a.periodKey) || b.id - a.id
  );

  // Atualiza também os KPIs do topo e o gráfico de categorias com o filtro aplicado!
  renderKPIs();
  renderCategoryBreakdown();
  renderInstallmentsSummary();

  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma transação ou conta encontrada com este filtro (R$ 0,00).</p>`;
    return;
  }

  container.innerHTML = filtered.map(createTransactionCardHTML).join('');
}

/**
 * Renderiza a Aba dedicada "Filtros & Contas" (#viewFiltros)
 */
function renderFilterTabView() {
  const fMonth = document.getElementById('tabFilterMonth').value;
  const fYear = document.getElementById('tabFilterYear').value;
  const fBank = document.getElementById('tabFilterBank').value;
  const fCategory = document.getElementById('tabFilterCategory').value;
  const fModality = document.getElementById('tabFilterModality').value;
  const fSearch = document.getElementById('tabFilterSearch').value.toLowerCase().trim();

  const filtered = transactions
    .filter((t) => {
      if (fYear !== 'all' && String(t.year) !== String(fYear)) return false;
      if (fMonth !== 'all' && t.month !== fMonth) return false;
      if (fBank !== 'all' && t.account !== fBank) return false;
      if (fCategory !== 'all' && t.category !== fCategory) return false;
      if (fModality === 'installment' && !t.isInstallment) return false;
      if (fModality === 'single' && t.isInstallment) return false;
      if (
        fSearch &&
        !t.description.toLowerCase().includes(fSearch) &&
        !t.account.toLowerCase().includes(fSearch) &&
        !t.category.toLowerCase().includes(fSearch)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey) || b.id - a.id);

  const { income, expenses, netSavings, savingsRate, incomeCount, expenseCount } = calculateSummary(filtered);

  document.getElementById('tabKpiCount').textContent = String(filtered.length);
  const monthLabel = fMonth === 'all' ? 'Todos os meses' : MONTH_NAMES[fMonth];
  const yearLabel = fYear === 'all' ? 'Todos os anos' : fYear;
  const bankLabel = fBank === 'all' ? 'Todos os bancos' : fBank;
  document.getElementById('tabKpiFilterSummary').textContent = `${monthLabel} • ${yearLabel} • ${bankLabel}`;

  document.getElementById('tabKpiIncome').textContent = formatBRL(income);
  document.getElementById('tabKpiIncomeSub').textContent = `${incomeCount} entrada(s) no filtro`;

  document.getElementById('tabKpiExpenses').textContent = formatBRL(expenses);
  document.getElementById('tabKpiExpenseSub').textContent = `${expenseCount} saída(s) no filtro`;

  const balEl = document.getElementById('tabKpiBalance');
  balEl.textContent = formatBRL(netSavings);
  balEl.className = `kpi-value ${netSavings > 0 ? 'positive-text' : netSavings < 0 ? 'negative-text' : ''}`;
  document.getElementById('tabKpiSavingsRate').textContent = `Taxa de economia no filtro: ${savingsRate}%`;

  const container = document.getElementById('tabFilteredListContainer');
  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma transação ou conta encontrada para os filtros selecionados (R$ 0,00).</p>`;
    return;
  }

  container.innerHTML = filtered.map(createTransactionCardHTML).join('');
}

function updateInstallmentPreview() {
  if (!isInstallmentMode) return;
  const rawAmount = parseFloat(document.getElementById('txAmount').value) || 0;
  const count = Math.max(2, parseInt(document.getElementById('txInstallments').value, 10) || 2);
  const valueMode = document.getElementById('txValueMode').value;
  const startMonth = parseInt(document.getElementById('txStartMonth').value, 10) || 10;
  const startYear = parseInt(document.getElementById('txStartYear').value, 10) || 2026;

  const parcelValue = valueMode === 'total' ? rawAmount / count : rawAmount;
  const totalValue = valueMode === 'total' ? rawAmount : rawAmount * count;

  const firstPeriod = addMonthsToPeriod(startYear, startMonth, 0);
  const lastPeriod = addMonthsToPeriod(startYear, startMonth, count - 1);

  document.getElementById('installmentPreview').textContent =
    `${count}x de ${formatBRL(parcelValue)} (Total: ${formatBRL(totalValue)}) • De ${formatPeriodLabel(firstPeriod.periodKey)} até ${formatPeriodLabel(lastPeriod.periodKey)}`;
}

function refreshDashboard() {
  populateYearSelectors();
  populateBankSelectors();
  renderCashflowChart();
  renderTransactionsList();
  renderFilterTabView();
}

function handleCardActionClick(e) {
  const editBtn = e.target.closest('[data-edit-id]');
  if (editBtn) {
    const id = Number(editBtn.getAttribute('data-edit-id'));
    openEditModal(id);
    return;
  }

  const deleteBtn = e.target.closest('[data-delete-id]');
  if (deleteBtn) {
    const id = Number(deleteBtn.getAttribute('data-delete-id'));
    const targetTx = transactions.find((t) => t.id === id);
    if (!targetTx) return;

    if (targetTx.isInstallment && targetTx.groupId) {
      const deleteAll = confirm(
        `Esta conta faz parte do parcelamento "${targetTx.baseDescription || targetTx.description}" (${targetTx.installmentNumber}/${targetTx.totalInstallments}).\n\nClique em OK para excluir TODAS as parcelas deste lançamento, ou Cancelar para excluir APENAS a parcela deste mês.`
      );
      if (deleteAll) {
        transactions = transactions.filter((t) => t.groupId !== targetTx.groupId);
      } else {
        transactions = transactions.filter((t) => t.id !== id);
      }
    } else {
      transactions = transactions.filter((t) => t.id !== id);
    }

    saveTransactions();
    refreshDashboard();
  }
}

function openNewModal() {
  document.getElementById('editingTxId').value = '';
  document.getElementById('modalTitle').textContent = 'Adicionar Nova Transação';
  document.getElementById('btnSubmitTx').textContent = 'Salvar Transação';
  document.getElementById('transactionForm').reset();

  document.getElementById('paymentModeGroup').classList.remove('hidden');
  document.getElementById('editScopeBox').classList.add('hidden');
  document.getElementById('customAccountGroup').classList.add('hidden');
  document.getElementById('btnModeAvista').click();

  document.getElementById('txStartMonth').value = selectedMonth === 'all' ? '10' : selectedMonth;
  document.getElementById('txStartYear').value = selectedYear;
  document.getElementById('transactionModal').classList.remove('hidden');
}

function openEditModal(txId) {
  const tx = transactions.find((t) => t.id === txId);
  if (!tx) return;

  populateBankSelectors();
  document.getElementById('editingTxId').value = String(tx.id);
  document.getElementById('modalTitle').textContent = 'Editar Conta / Transação';
  document.getElementById('btnSubmitTx').textContent = 'Salvar Alterações';

  document.getElementById('txDescription').value = tx.baseDescription || tx.description;
  document.getElementById('txAmount').value = tx.amount;
  document.getElementById('txType').value = tx.type;
  document.getElementById('txCategory').value = tx.category;
  document.getElementById('txAccount').value = tx.account;
  document.getElementById('customAccountGroup').classList.add('hidden');
  document.getElementById('txStartMonth').value = tx.month;
  document.getElementById('txStartYear').value = tx.year;

  document.getElementById('paymentModeGroup').classList.add('hidden');
  document.getElementById('installmentFields').classList.add('hidden');

  if (tx.isInstallment && tx.groupId) {
    document.getElementById('editScopeBox').classList.remove('hidden');
    document.getElementById('txEditScope').value = 'all';
  } else {
    document.getElementById('editScopeBox').classList.add('hidden');
  }

  document.getElementById('transactionModal').classList.remove('hidden');
}

/* Event Listeners */
document.addEventListener('DOMContentLoaded', () => {
  renderUserName();
  document.getElementById('tabFilterYear').value = String(selectedYear);
  refreshDashboard();

  // Alternar entre as abas da barra lateral: "Visão Geral" e "Filtros & Contas"
  const navItems = document.querySelectorAll('.nav-menu .nav-item');
  const viewVisaoGeral = document.getElementById('viewVisaoGeral');
  const viewFiltros = document.getElementById('viewFiltros');
  const topPeriodPicker = document.getElementById('topPeriodPicker');

  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');

      const view = item.getAttribute('data-view');
      if (view === 'filtros') {
        viewVisaoGeral.classList.add('hidden');
        viewFiltros.classList.remove('hidden');
        topPeriodPicker.classList.add('hidden');
        renderFilterTabView();
      } else {
        viewFiltros.classList.add('hidden');
        viewVisaoGeral.classList.remove('hidden');
        topPeriodPicker.classList.remove('hidden');
        refreshDashboard();
      }
    });
  });

  // Eventos dos filtros da aba "Filtros & Contas"
  ['tabFilterMonth', 'tabFilterYear', 'tabFilterBank', 'tabFilterCategory', 'tabFilterModality', 'tabFilterSearch'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('change', renderFilterTabView);
    el.addEventListener('input', renderFilterTabView);
  });

  document.getElementById('btnClearTabFilters').addEventListener('click', () => {
    document.getElementById('tabFilterMonth').value = 'all';
    document.getElementById('tabFilterYear').value = 'all';
    document.getElementById('tabFilterBank').value = 'all';
    document.getElementById('tabFilterCategory').value = 'all';
    document.getElementById('tabFilterModality').value = 'all';
    document.getElementById('tabFilterSearch').value = '';
    renderFilterTabView();
  });

  // Eventos do Agente de Lançamento Rápido
  const agentForm = document.getElementById('agentCommandForm');
  const agentInput = document.getElementById('agentCommandInput');

  agentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cmd = agentInput.value.trim();
    if (!cmd) return;
    parseAndExecuteAgentCommand(cmd);
    agentInput.value = '';
  });

  document.querySelectorAll('.agent-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const example = chip.getAttribute('data-example');
      agentInput.value = example;
      agentInput.focus();
    });
  });

  document.getElementById('btnUndoAgent').addEventListener('click', () => {
    if (lastAgentBatchIds.length > 0) {
      transactions = transactions.filter((t) => !lastAgentBatchIds.includes(t.id));
      lastAgentBatchIds = [];
      saveTransactions();
      refreshDashboard();
      showAgentFeedback('🤖 Último lançamento do agente foi desfeito com sucesso.', false);
    }
  });

  // Editar nome do usuário no perfil
  const nameEditBox = document.getElementById('userNameEditBox');
  const nameInput = document.getElementById('userNameInput');

  document.getElementById('btnEditUserName').addEventListener('click', () => {
    nameInput.value = userName;
    nameEditBox.classList.remove('hidden');
    nameInput.focus();
  });

  document.getElementById('btnCancelUserName').addEventListener('click', () => {
    nameEditBox.classList.add('hidden');
  });

  document.getElementById('btnSaveUserName').addEventListener('click', () => {
    const newName = nameInput.value.trim();
    if (newName) {
      userName = newName;
      localStorage.setItem(USER_NAME_KEY, userName);
      renderUserName();
    }
    nameEditBox.classList.add('hidden');
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btnSaveUserName').click();
    }
  });

  // Seletores de mês e ano na Visão Geral
  const monthSelect = document.getElementById('monthSelector');
  const yearSelect = document.getElementById('yearSelector');

  monthSelect.addEventListener('change', (e) => {
    selectedMonth = e.target.value;
    document.getElementById('tabFilterMonth').value = selectedMonth;
    refreshDashboard();
  });

  yearSelect.addEventListener('change', (e) => {
    selectedYear = Number(e.target.value);
    document.getElementById('tabFilterYear').value = String(selectedYear);
    refreshDashboard();
  });

  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    const currentM = selectedMonth === 'all' ? 1 : Number(selectedMonth);
    const prev = addMonthsToPeriod(selectedYear, currentM, -1);
    selectedYear = prev.year;
    selectedMonth = prev.month;
    monthSelect.value = selectedMonth;
    document.getElementById('tabFilterMonth').value = selectedMonth;
    document.getElementById('tabFilterYear').value = String(selectedYear);
    refreshDashboard();
  });

  document.getElementById('btnNextMonth').addEventListener('click', () => {
    const currentM = selectedMonth === 'all' ? 12 : Number(selectedMonth);
    const next = addMonthsToPeriod(selectedYear, currentM, 1);
    selectedYear = next.year;
    selectedMonth = next.month;
    monthSelect.value = selectedMonth;
    document.getElementById('tabFilterMonth').value = selectedMonth;
    document.getElementById('tabFilterYear').value = String(selectedYear);
    refreshDashboard();
  });

  document.getElementById('cashflowChart').addEventListener('click', (e) => {
    const group = e.target.closest('[data-select-month]');
    if (!group) return;
    selectedMonth = group.getAttribute('data-select-month');
    monthSelect.value = selectedMonth;
    refreshDashboard();
  });

  // Filtros na Visão Geral (atualizam também os KPIs de Receita, Despesa e Balanço!)
  document.getElementById('searchInput').addEventListener('input', renderTransactionsList);
  document.getElementById('categoryFilter').addEventListener('change', renderTransactionsList);
  document.getElementById('bankFilter').addEventListener('change', renderTransactionsList);

  // Eventos de Editar e Excluir em todas as listas
  document.getElementById('installmentsSummaryList').addEventListener('click', handleCardActionClick);
  document.getElementById('transactionsListContainer').addEventListener('click', handleCardActionClick);
  document.getElementById('tabFilteredListContainer').addEventListener('click', handleCardActionClick);

  // Exportar e Importar Backup (transferir dados de um PC para outro)
  document.getElementById('btnExportData').addEventListener('click', () => {
    const backupPayload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      userName,
      customBanks,
      transactions
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-minhas-financas-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showAgentFeedback(
      `📥 <strong>Backup exportado com sucesso!</strong> Basta enviar o arquivo <code>backup-minhas-financas-${dateStr}.json</code> para o seu outro PC e clicar em "Importar Backup".`,
      false
    );
  });

  const importFileInput = document.getElementById('importFileInput');
  document.getElementById('btnImportData').addEventListener('click', () => {
    importFileInput.value = '';
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const importedTx = Array.isArray(parsed) ? parsed : parsed.transactions;

        if (!Array.isArray(importedTx)) {
          alert('O arquivo selecionado não é um backup válido do Minhas Finanças.');
          return;
        }

        if (parsed.userName && typeof parsed.userName === 'string') {
          userName = parsed.userName;
          localStorage.setItem(USER_NAME_KEY, userName);
          renderUserName();
        }

        if (Array.isArray(parsed.customBanks)) {
          parsed.customBanks.forEach((b) => {
            if (!customBanks.includes(b)) customBanks.push(b);
          });
          saveCustomBanks();
        }

        if (transactions.length > 0) {
          const replaceAll = confirm(
            `O arquivo contém ${importedTx.length} lançamento(s).\n\nClique em OK para SUBSTITUIR os dados atuais pelos dados do backup, ou em Cancelar para JUNTAR (mesclar) os dados do backup com os atuais.`
          );
          if (replaceAll) {
            transactions = importedTx;
          } else {
            const existingIds = new Set(transactions.map((t) => t.id));
            importedTx.forEach((t) => {
              if (!existingIds.has(t.id)) {
                transactions.push(t);
              }
            });
          }
        } else {
          transactions = importedTx;
        }

        saveTransactions();
        refreshDashboard();
        showAgentFeedback(
          `📤 <strong>Backup importado com sucesso!</strong> ${importedTx.length} lançamento(s) foram carregados neste computador.`,
          false
        );
      } catch (err) {
        alert('Erro ao ler o arquivo de backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Botão Zerar Todos os Dados
  document.getElementById('btnResetAll').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja zerar todas as transações e deixar todos os saldos em R$ 0,00?')) {
      transactions = [];
      saveTransactions();
      refreshDashboard();
    }
  });

  // Modal Nova / Editar Transação
  const modal = document.getElementById('transactionModal');
  const closeModal = () => modal.classList.add('hidden');

  document.getElementById('btnOpenModal').addEventListener('click', openNewModal);
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeModal);

  document.getElementById('txAccount').addEventListener('change', (e) => {
    const customGroup = document.getElementById('customAccountGroup');
    if (e.target.value === '__custom__') {
      customGroup.classList.remove('hidden');
      document.getElementById('txCustomAccount').focus();
    } else {
      customGroup.classList.add('hidden');
    }
  });

  const btnModeAvista = document.getElementById('btnModeAvista');
  const btnModeParcelado = document.getElementById('btnModeParcelado');
  const installmentFields = document.getElementById('installmentFields');

  btnModeAvista.addEventListener('click', () => {
    isInstallmentMode = false;
    btnModeAvista.classList.add('active');
    btnModeParcelado.classList.remove('active');
    installmentFields.classList.add('hidden');
  });

  btnModeParcelado.addEventListener('click', () => {
    isInstallmentMode = true;
    btnModeParcelado.classList.add('active');
    btnModeAvista.classList.remove('active');
    installmentFields.classList.remove('hidden');
    updateInstallmentPreview();
  });

  ['txAmount', 'txInstallments', 'txValueMode', 'txStartMonth', 'txStartYear'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateInstallmentPreview);
    document.getElementById(id).addEventListener('change', updateInstallmentPreview);
  });

  document.getElementById('txType').addEventListener('change', (e) => {
    const catSelect = document.getElementById('txCategory');
    if (e.target.value === 'income') {
      catSelect.value = 'Receita';
    } else if (catSelect.value === 'Receita') {
      catSelect.value = 'Alimentação';
    }
  });

  document.getElementById('transactionForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const editingId = document.getElementById('editingTxId').value;
    const baseDescription = document.getElementById('txDescription').value.trim();
    const rawAmount = parseFloat(document.getElementById('txAmount').value);
    const type = document.getElementById('txType').value;
    const category = type === 'income' ? 'Receita' : document.getElementById('txCategory').value;

    let account = document.getElementById('txAccount').value;
    if (account === '__custom__') {
      const customName = document.getElementById('txCustomAccount').value.trim();
      account = customName || 'Outra Conta';
      if (!customBanks.includes(account)) {
        customBanks.push(account);
        saveCustomBanks();
      }
    }

    const startMonth = parseInt(document.getElementById('txStartMonth').value, 10);
    const startYear = parseInt(document.getElementById('txStartYear').value, 10);

    if (!baseDescription || isNaN(rawAmount) || rawAmount <= 0) return;

    if (editingId) {
      const idNum = Number(editingId);
      const targetTx = transactions.find((t) => t.id === idNum);
      if (targetTx) {
        const editScope = document.getElementById('txEditScope').value;
        const period = addMonthsToPeriod(startYear, startMonth, 0);

        if (targetTx.isInstallment && targetTx.groupId && editScope === 'all') {
          transactions.forEach((t) => {
            if (t.groupId === targetTx.groupId) {
              t.baseDescription = baseDescription;
              t.description = `${baseDescription} (${t.installmentNumber}/${t.totalInstallments})`;
              t.amount = Math.round(rawAmount * 100) / 100;
              t.type = type;
              t.category = category;
              t.account = account;
            }
          });
        } else {
          targetTx.baseDescription = baseDescription;
          targetTx.description = targetTx.isInstallment
            ? `${baseDescription} (${targetTx.installmentNumber}/${targetTx.totalInstallments})`
            : baseDescription;
          targetTx.amount = Math.round(rawAmount * 100) / 100;
          targetTx.type = type;
          targetTx.category = category;
          targetTx.account = account;
          targetTx.year = period.year;
          targetTx.month = period.month;
          targetTx.periodKey = period.periodKey;
        }
      }
    } else if (!isInstallmentMode) {
      const period = addMonthsToPeriod(startYear, startMonth, 0);
      transactions.push({
        id: Date.now(),
        description: baseDescription,
        baseDescription,
        amount: Math.round(rawAmount * 100) / 100,
        type,
        category,
        account,
        year: period.year,
        month: period.month,
        periodKey: period.periodKey,
        isInstallment: false,
        installmentNumber: 1,
        totalInstallments: 1
      });
    } else {
      const count = Math.max(2, parseInt(document.getElementById('txInstallments').value, 10) || 2);
      const valueMode = document.getElementById('txValueMode').value;
      const parcelAmount =
        valueMode === 'total'
          ? Math.round((rawAmount / count) * 100) / 100
          : Math.round(rawAmount * 100) / 100;

      const groupId = `grp_${Date.now()}`;

      for (let i = 0; i < count; i++) {
        const period = addMonthsToPeriod(startYear, startMonth, i);
        transactions.push({
          id: Date.now() + i,
          groupId,
          description: `${baseDescription} (${i + 1}/${count})`,
          baseDescription,
          amount: parcelAmount,
          type,
          category,
          account,
          year: period.year,
          month: period.month,
          periodKey: period.periodKey,
          isInstallment: true,
          installmentNumber: i + 1,
          totalInstallments: count
        });
      }
    }

    selectedYear = startYear;
    selectedMonth = String(startMonth).padStart(2, '0');
    document.getElementById('monthSelector').value = selectedMonth;
    document.getElementById('tabFilterMonth').value = selectedMonth;
    document.getElementById('tabFilterYear').value = String(selectedYear);

    saveTransactions();
    refreshDashboard();
    closeModal();
  });

  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const nextTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', nextTheme);
  });
});
