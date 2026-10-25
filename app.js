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

/**
 * Soma meses a um par (ano, mês 1..12) avançando anos automaticamente
 * mesmo se passar de Dezembro ou tiver mais de 12 parcelas.
 */
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

function populateYearSelector() {
  const yearSelect = document.getElementById('yearSelector');
  const txYears = transactions.map((t) => Number(t.year)).filter(Boolean);
  const minYear = Math.min(2025, ...txYears);
  const maxYear = Math.max(2030, selectedYear, ...txYears);

  const options = [];
  for (let y = minYear; y <= maxYear; y++) {
    options.push(`<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`);
  }
  yearSelect.innerHTML = options.join('');
}

function populateBankSelectors() {
  const banks = getAllBanks();

  // Filtro de bancos na seção Transações
  const bankFilter = document.getElementById('bankFilter');
  const currentFilterVal = bankFilter.value || 'all';
  bankFilter.innerHTML =
    `<option value="all">Todos os bancos</option>` +
    banks.map((b) => `<option value="${b}">${b}</option>`).join('');
  if (banks.includes(currentFilterVal) || currentFilterVal === 'all') {
    bankFilter.value = currentFilterVal;
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
  const periodList = getPeriodTransactions();
  const { income, expenses, netSavings, savingsRate, incomeCount, expenseCount } = calculateSummary(periodList);
  const allSummary = calculateSummary(transactions);

  document.getElementById('kpiTotalBalance').textContent = formatBRL(allSummary.netSavings);
  document.getElementById('kpiIncome').textContent = formatBRL(income);
  document.getElementById('kpiIncomeCount').textContent = `${incomeCount} entrada(s) no período`;

  document.getElementById('kpiExpenses').textContent = formatBRL(expenses);
  document.getElementById('kpiExpenseSubtext').textContent = `${expenseCount} saída(s) no período`;

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
  const periodList = getPeriodTransactions();
  const { expenses, byCategory } = calculateSummary(periodList);

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const colors = ['fill-indigo', 'fill-emerald', 'fill-amber', 'fill-danger'];

  if (entries.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma despesa registrada neste período (R$ 0,00).</p>`;
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

/**
 * Gera o card visual com barra de progresso (usado tanto em Parcelamentos quanto em Transações / Contas)
 */
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
  const periodList = getPeriodTransactions()
    .filter((t) => t.isInstallment)
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey) || b.id - a.id);

  if (periodList.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma parcela ativa neste período (R$ 0,00).</p>`;
    return;
  }

  container.innerHTML = periodList.map(createTransactionCardHTML).join('');
}

function renderTransactionsList() {
  const container = document.getElementById('transactionsListContainer');
  const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
  const catFilter = document.getElementById('categoryFilter').value;
  const bankFilter = document.getElementById('bankFilter').value;

  const filtered = getPeriodTransactions()
    .filter((t) => {
      const matchesSearch =
        t.description.toLowerCase().includes(searchQuery) ||
        t.account.toLowerCase().includes(searchQuery);
      const matchesCat = catFilter === 'all' || t.category === catFilter;
      const matchesBank = bankFilter === 'all' || t.account === bankFilter;
      return matchesSearch && matchesCat && matchesBank;
    })
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey) || b.id - a.id);

  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma transação ou conta cadastrada neste período (R$ 0,00).</p>`;
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
  populateYearSelector();
  populateBankSelectors();
  renderKPIs();
  renderCashflowChart();
  renderCategoryBreakdown();
  renderInstallmentsSummary();
  renderTransactionsList();
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

  // Ao editar item existente, esconde o gerador de novas parcelas e mostra escopo se for parcelado
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
  refreshDashboard();

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

  // Seletores de mês e ano
  const monthSelect = document.getElementById('monthSelector');
  const yearSelect = document.getElementById('yearSelector');

  monthSelect.addEventListener('change', (e) => {
    selectedMonth = e.target.value;
    refreshDashboard();
  });

  yearSelect.addEventListener('change', (e) => {
    selectedYear = Number(e.target.value);
    refreshDashboard();
  });

  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    const currentM = selectedMonth === 'all' ? 1 : Number(selectedMonth);
    const prev = addMonthsToPeriod(selectedYear, currentM, -1);
    selectedYear = prev.year;
    selectedMonth = prev.month;
    monthSelect.value = selectedMonth;
    refreshDashboard();
  });

  document.getElementById('btnNextMonth').addEventListener('click', () => {
    const currentM = selectedMonth === 'all' ? 12 : Number(selectedMonth);
    const next = addMonthsToPeriod(selectedYear, currentM, 1);
    selectedYear = next.year;
    selectedMonth = next.month;
    monthSelect.value = selectedMonth;
    refreshDashboard();
  });

  document.getElementById('cashflowChart').addEventListener('click', (e) => {
    const group = e.target.closest('[data-select-month]');
    if (!group) return;
    selectedMonth = group.getAttribute('data-select-month');
    monthSelect.value = selectedMonth;
    refreshDashboard();
  });

  document.getElementById('searchInput').addEventListener('input', renderTransactionsList);
  document.getElementById('categoryFilter').addEventListener('change', renderTransactionsList);
  document.getElementById('bankFilter').addEventListener('change', renderTransactionsList);

  // Eventos de Editar e Excluir tanto em Parcelamentos quanto em Transações
  document.getElementById('installmentsSummaryList').addEventListener('click', handleCardActionClick);
  document.getElementById('transactionsListContainer').addEventListener('click', handleCardActionClick);

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

  // Mostrar campo de digitar banco/conta personalizado quando selecionar "__custom__"
  document.getElementById('txAccount').addEventListener('change', (e) => {
    const customGroup = document.getElementById('customAccountGroup');
    if (e.target.value === '__custom__') {
      customGroup.classList.remove('hidden');
      document.getElementById('txCustomAccount').focus();
    } else {
      customGroup.classList.add('hidden');
    }
  });

  // Alternar entre À vista e Parcelado
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

  // Salvar Nova Transação ou Edição de Conta Existente
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

    // Caso esteja EDITANDO uma transação/conta existente
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
      // Nova transação À Vista
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
      // Nova transação Parcelada
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

    saveTransactions();
    refreshDashboard();
    closeModal();
  });

  // Alternar Tema Claro/Escuro
  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const nextTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', nextTheme);
  });
});
