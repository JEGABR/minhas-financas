const STORAGE_KEY = 'minhas_financas_v2_tx';
const USER_NAME_KEY = 'minhas_financas_username';
const CUSTOM_BANKS_KEY = 'minhas_financas_custom_banks';
const CHART_COLORS_KEY = 'minhas_financas_chart_colors';
const UI_PREFS_KEY = 'minhas_financas_ui_prefs';

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

const DEFAULT_CHART_COLORS = {
  income: '#10b981',
  expense: '#f43f5e'
};

const DEFAULT_UI_PREFS = {
  theme: 'dark',
  activeView: 'visao-geral',
  selectedMonth: '10',
  selectedYear: 2026,
  hidePaidInstallments: false,
  instViewScope: 'period'
};

let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let customBanks = JSON.parse(localStorage.getItem(CUSTOM_BANKS_KEY)) || [];
let userName = localStorage.getItem(USER_NAME_KEY) || 'Gabriel';
let chartColors = JSON.parse(localStorage.getItem(CHART_COLORS_KEY)) || { ...DEFAULT_CHART_COLORS };
let uiPrefs = {
  ...DEFAULT_UI_PREFS,
  ...(JSON.parse(localStorage.getItem(UI_PREFS_KEY)) || {})
};
let selectedMonth = uiPrefs.selectedMonth || '10';
let selectedYear = Number(uiPrefs.selectedYear) || 2026;
let isInstallmentMode = false;
let lastAgentBatchIds = [];

// Aplica o tema salvo imediatamente ao carregar o script
document.documentElement.setAttribute('data-theme', uiPrefs.theme === 'light' ? 'light' : 'dark');

function saveUiPrefs() {
  uiPrefs.selectedMonth = selectedMonth;
  uiPrefs.selectedYear = selectedYear;
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefs));
}

/* ==========================================
   SISTEMA DE FILTRO MULTI-SELEÇÃO
   ========================================== */
const multiSelectInstances = {};

function getSelectedFilterValues(selectId) {
  if (multiSelectInstances[selectId]) {
    return multiSelectInstances[selectId].getSelected();
  }
  const el = document.getElementById(selectId);
  if (!el) return [];
  if (el.value === 'all') return [];
  return [el.value];
}

function createMultiSelect({ selectId, allLabel, placeholder, onChange }) {
  const originalSelect = document.getElementById(selectId);
  if (!originalSelect) return null;

  const options = [];
  Array.from(originalSelect.options).forEach((opt) => {
    if (opt.value && opt.value !== 'all' && opt.value !== '__custom__') {
      options.push({ value: opt.value, label: opt.textContent.trim() });
    }
  });

  originalSelect.style.display = 'none';

  let wrap = document.getElementById(`${selectId}_ms_wrap`);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = `${selectId}_ms_wrap`;
    wrap.className = 'multiselect-dropdown';
    originalSelect.parentNode.insertBefore(wrap, originalSelect);
  }

  const state = {
    selected: new Set(),
    options: options,
    allLabel: allLabel || 'Todas as categorias',
    placeholder: placeholder || 'Filtro'
  };

  function updateTriggerText() {
    const triggerText = wrap.querySelector('.multiselect-trigger-text');
    const badge = wrap.querySelector('.multiselect-badge');
    if (!triggerText || !badge) return;

    const selCount = state.selected.size;

    if (selCount === 0 || selCount === state.options.length) {
      triggerText.textContent = state.allLabel;
      badge.style.display = 'none';
      wrap.classList.remove('has-selection');
    } else if (selCount <= 2) {
      const names = Array.from(state.selected)
        .map((val) => {
          const opt = state.options.find((o) => o.value === val);
          return opt ? opt.label : val;
        })
        .join(', ');
      triggerText.textContent = names;
      badge.style.display = 'none';
      wrap.classList.add('has-selection');
    } else {
      triggerText.textContent = `${selCount} selecionadas`;
      badge.textContent = String(selCount);
      badge.style.display = 'inline-block';
      wrap.classList.add('has-selection');
    }
  }

  function renderMenu() {
    wrap.innerHTML = `
      <button type="button" class="select-control multiselect-trigger" aria-haspopup="listbox">
        <span class="multiselect-trigger-text">${state.allLabel}</span>
        <span class="multiselect-badge" style="display:none">0</span>
        <span class="multiselect-arrow">▾</span>
      </button>
      <div class="multiselect-menu hidden">
        <div class="multiselect-header">
          <button type="button" class="btn-ms-action btn-ms-all">Selecionar todas</button>
          <button type="button" class="btn-ms-action btn-ms-clear">Limpar</button>
        </div>
        <div class="multiselect-options">
          ${state.options
            .map(
              (opt) => `
            <label class="multiselect-option">
              <input type="checkbox" value="${opt.value}" ${state.selected.has(opt.value) ? 'checked' : ''} />
              <span>${opt.label}</span>
            </label>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    updateTriggerText();

    const triggerBtn = wrap.querySelector('.multiselect-trigger');
    const menu = wrap.querySelector('.multiselect-menu');

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.multiselect-dropdown.open').forEach((other) => {
        if (other !== wrap) {
          other.classList.remove('open');
          other.querySelector('.multiselect-menu')?.classList.add('hidden');
        }
      });
      const isOpen = !menu.classList.contains('hidden');
      menu.classList.toggle('hidden', isOpen);
      wrap.classList.toggle('open', !isOpen);
    });

    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    wrap.querySelectorAll('.multiselect-options input[type="checkbox"]').forEach((chk) => {
      chk.addEventListener('change', () => {
        if (chk.checked) {
          state.selected.add(chk.value);
        } else {
          state.selected.delete(chk.value);
        }
        updateTriggerText();
        if (onChange) onChange(Array.from(state.selected));
      });
    });

    wrap.querySelector('.btn-ms-all').addEventListener('click', () => {
      state.options.forEach((opt) => state.selected.add(opt.value));
      wrap.querySelectorAll('.multiselect-options input[type="checkbox"]').forEach((chk) => (chk.checked = true));
      updateTriggerText();
      if (onChange) onChange(Array.from(state.selected));
    });

    wrap.querySelector('.btn-ms-clear').addEventListener('click', () => {
      state.selected.clear();
      wrap.querySelectorAll('.multiselect-options input[type="checkbox"]').forEach((chk) => (chk.checked = false));
      updateTriggerText();
      if (onChange) onChange([]);
    });
  }

  renderMenu();

  const instance = {
    setOptions(newOptions) {
      state.options = newOptions;
      const valid = new Set(newOptions.map((o) => o.value));
      state.selected = new Set(Array.from(state.selected).filter((v) => valid.has(v)));
      renderMenu();
    },
    getSelected() {
      if (state.selected.size === 0 || state.selected.size === state.options.length) {
        return [];
      }
      return Array.from(state.selected);
    },
    setSelected(values) {
      state.selected = new Set(values);
      wrap.querySelectorAll('.multiselect-options input[type="checkbox"]').forEach((chk) => {
        chk.checked = state.selected.has(chk.value);
      });
      updateTriggerText();
    },
    clear() {
      state.selected.clear();
      wrap.querySelectorAll('.multiselect-options input[type="checkbox"]').forEach((chk) => (chk.checked = false));
      updateTriggerText();
    }
  };

  multiSelectInstances[selectId] = instance;
  return instance;
}

function initAllMultiSelects() {
  createMultiSelect({
    selectId: 'categoryFilter',
    allLabel: 'Todas as categorias',
    onChange: () => renderTransactionsList()
  });

  createMultiSelect({
    selectId: 'bankFilter',
    allLabel: 'Todos os bancos',
    onChange: () => renderTransactionsList()
  });

  createMultiSelect({
    selectId: 'payoffCategoryFilter',
    allLabel: 'Todas as categorias',
    onChange: () => renderPayoffDebtsView()
  });

  createMultiSelect({
    selectId: 'payoffBankFilter',
    allLabel: 'Todos os bancos',
    onChange: () => renderPayoffDebtsView()
  });

  createMultiSelect({
    selectId: 'tabFilterCategory',
    allLabel: 'Todas as categorias',
    onChange: () => renderFilterTabView()
  });

  createMultiSelect({
    selectId: 'tabFilterBank',
    allLabel: 'Todos os bancos',
    onChange: () => renderFilterTabView()
  });
}

// Conjuntos de IDs selecionados para pagar/quitar múltiplas dívidas
let selectedPayoffTxIds = new Set();
let selectedPeriodTxIds = new Set();
let selectedFilterTabTxIds = new Set();

function normalizeTransactions() {
  transactions.forEach((t) => {
    let yr = Number(t.year);
    let mo = t.month != null ? String(t.month).trim() : '';
    if ((!yr || !mo) && t.periodKey && String(t.periodKey).includes('-')) {
      const [pkY, pkM] = String(t.periodKey).split('-');
      if (!yr) yr = Number(pkY);
      if (!mo) mo = String(pkM).trim();
    }
    if (!yr || isNaN(yr)) yr = 2026;
    const moNum = parseInt(mo, 10);
    mo = !isNaN(moNum) && moNum >= 1 && moNum <= 12 ? String(moNum).padStart(2, '0') : '10';

    t.year = yr;
    t.month = mo;
    t.periodKey = `${yr}-${mo}`;
    t.description = String(t.description || t.baseDescription || 'Lançamento');
    t.account = String(t.account || 'Nubank');
    if (t.totalInstallments > 1 || t.groupId) {
      t.isInstallment = true;
    }
  });
}

normalizeTransactions();

function applyChartColors() {
  const inc = chartColors.income || DEFAULT_CHART_COLORS.income;
  const exp = chartColors.expense || DEFAULT_CHART_COLORS.expense;
  document.documentElement.style.setProperty('--chart-income-color', inc);
  document.documentElement.style.setProperty('--chart-expense-color', exp);

  const incInput = document.getElementById('colorPickerIncome');
  const expInput = document.getElementById('colorPickerExpense');
  if (incInput) incInput.value = inc;
  if (expInput) expInput.value = exp;
}

function saveChartColors() {
  localStorage.setItem(CHART_COLORS_KEY, JSON.stringify(chartColors));
}

/**
 * Analisa o comando digitado no Agente e retorna os campos interpretados
 */
function analyzeAgentCommand(rawInput) {
  const text = rawInput.trim();
  if (!text) return null;

  const lower = text.toLowerCase();

  // 1. Detectar mês e ano mencionados na frase (ex: "em novembro", "em janeiro de 2027")
  const monthKeywords = [
    { num: 1, words: ['janeiro', 'jan'] },
    { num: 2, words: ['fevereiro', 'fev'] },
    { num: 3, words: ['março', 'marco', 'mar'] },
    { num: 4, words: ['abril', 'abr'] },
    { num: 5, words: ['maio', 'mai'] },
    { num: 6, words: ['junho', 'jun'] },
    { num: 7, words: ['julho', 'jul'] },
    { num: 8, words: ['agosto', 'ago'] },
    { num: 9, words: ['setembro', 'set'] },
    { num: 10, words: ['outubro', 'out'] },
    { num: 11, words: ['novembro', 'nov'] },
    { num: 12, words: ['dezembro', 'dez'] }
  ];

  let startMonthNum = selectedMonth === 'all' ? 10 : parseInt(selectedMonth, 10);
  let startYearNum = selectedYear;
  let matchedMonthWords = [];

  for (const mItem of monthKeywords) {
    for (const w of mItem.words) {
      const mRgx = new RegExp(`\\b(?:em\\s+|a\\s+partir\\s+de\\s+|para\\s+)?(${w})(?:\\s+de\\s+(20\\d{2})|\\/(20\\d{2}))?\\b`, 'i');
      const match = text.match(mRgx);
      if (match) {
        startMonthNum = mItem.num;
        if (match[2] || match[3]) {
          startYearNum = parseInt(match[2] || match[3], 10);
        }
        matchedMonthWords.push(match[0]);
        break;
      }
    }
    if (matchedMonthWords.length > 0) break;
  }

  let workingText = text;
  matchedMonthWords.forEach((mw) => {
    workingText = workingText.replace(mw, ' ');
  });

  // 2. Detectar número de parcelas (ex: "em 12 vezes", "12x", "12 parcelas", "parcelado em 10")
  let installments = 1;
  let isParcelado = false;
  let matchedInstallmentStr = '';

  const parcelRegexes = [
    /(?:parcelad[oa]\s+em\s+|dividid[oa]\s+em\s+|em\s+)?(\d{1,3})\s*(?:vezes|x|parcelas?)\b/i,
    /\bparcelad[oa]\s+em\s+(\d{1,3})\b/i
  ];

  for (const rgx of parcelRegexes) {
    const m = workingText.match(rgx);
    if (m) {
      installments = Math.max(2, parseInt(m[1], 10));
      isParcelado = true;
      matchedInstallmentStr = m[0];
      break;
    }
  }

  const isParcelValueMode = /(?:\d{1,3})\s*(?:vezes|x|parcelas?)\s+de\s+(?:r\$\s*)?\d/i.test(workingText);

  let textWithoutInstallments = matchedInstallmentStr
    ? workingText.replace(matchedInstallmentStr, ' ')
    : workingText;

  // 3. Detectar valor monetário
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

  // 4. Detectar Banco / Conta (incluindo bancos personalizados)
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

  customBanks.forEach((cb) => {
    bankAliases.unshift({ keywords: [cb.toLowerCase()], bank: cb });
  });

  let detectedBank = 'Nubank';
  for (const item of bankAliases) {
    const found = item.keywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
    if (found) {
      detectedBank = item.bank;
      break;
    }
  }

  // 5. Detectar Tipo e Categoria
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
  } else if (/\b(empr[ée]stimo|consignado|financiamento|cr[ée]dito\s+pessoal)\b/i.test(lower)) {
    category = 'Empréstimo';
  }

  // 6. Extrair a Descrição limpa
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

  const parcelAmount = isParcelado
    ? isParcelValueMode
      ? Math.round(amount * 100) / 100
      : Math.round((amount / installments) * 100) / 100
    : Math.round(amount * 100) / 100;

  const totalAmount = isParcelado
    ? Math.round(parcelAmount * installments * 100) / 100
    : parcelAmount;

  return {
    cleanDesc,
    amount,
    parcelAmount,
    totalAmount,
    installments,
    isParcelado,
    isParcelValueMode,
    detectedBank,
    type,
    category,
    startMonthNum,
    startYearNum
  };
}

function updateAgentLivePreview() {
  const inputVal = document.getElementById('agentCommandInput').value;
  const previewEl = document.getElementById('agentLivePreview');
  const parsed = analyzeAgentCommand(inputVal);

  if (!parsed) {
    previewEl.classList.add('hidden');
    return;
  }

  const firstP = addMonthsToPeriod(parsed.startYearNum, parsed.startMonthNum, 0);
  const lastP = addMonthsToPeriod(parsed.startYearNum, parsed.startMonthNum, parsed.installments - 1);

  const modalityText = parsed.isParcelado
    ? `Parcelado em <strong>${parsed.installments}x de ${formatBRL(parsed.parcelAmount)}</strong> (Total: ${formatBRL(parsed.totalAmount)}) • ${formatPeriodLabel(firstP.periodKey)} a ${formatPeriodLabel(lastP.periodKey)}`
    : `À vista: <strong>${formatBRL(parsed.amount)}</strong> • ${formatPeriodLabel(firstP.periodKey)}`;

  previewEl.innerHTML = `🔎 <strong>Entendido pelo Agente:</strong> Item: <strong>"${parsed.cleanDesc}"</strong> | ${modalityText} | Banco: <strong>${parsed.detectedBank}</strong> | Categoria: <strong>${parsed.category}</strong>`;
  previewEl.classList.remove('hidden');
}

function parseAndExecuteAgentCommand(rawInput) {
  const parsed = analyzeAgentCommand(rawInput);
  if (!parsed) return;

  const {
    cleanDesc,
    amount,
    parcelAmount,
    totalAmount,
    installments,
    isParcelado,
    detectedBank,
    type,
    category,
    startMonthNum,
    startYearNum
  } = parsed;

  if (amount <= 0) {
    openNewModal();
    document.getElementById('txDescription').value = cleanDesc;
    document.getElementById('txType').value = type;
    document.getElementById('txCategory').value = category;
    document.getElementById('txAccount').value = detectedBank;
    document.getElementById('txStartMonth').value = String(startMonthNum).padStart(2, '0');
    document.getElementById('txStartYear').value = startYearNum;
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
      amount: parcelAmount,
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

    selectedYear = period.year;
    selectedMonth = period.month;
    document.getElementById('monthSelector').value = selectedMonth;

    saveTransactions();
    refreshDashboard();
    showAgentFeedback(
      `🤖 <strong>Agente:</strong> Lancei <strong>"${cleanDesc}"</strong> à vista no valor de <strong>${formatBRL(parcelAmount)}</strong> (${detectedBank} • ${category}) em ${formatPeriodLabel(period.periodKey)}.`,
      true
    );
  } else {
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

    selectedYear = firstP.year;
    selectedMonth = firstP.month;
    document.getElementById('monthSelector').value = selectedMonth;

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

  ['bankFilter', 'tabFilterBank', 'payoffBankFilter'].forEach((selectId) => {
    const el = document.getElementById(selectId);
    if (!el) return;
    const currentVal = el.value || 'all';
    el.innerHTML =
      `<option value="all">Todos os bancos</option>` +
      banks.map((b) => `<option value="${b}">${b}</option>`).join('');
    if (banks.includes(currentVal) || currentVal === 'all') {
      el.value = currentVal;
    }
  });

  const txAccount = document.getElementById('txAccount');
  const currentModalVal = txAccount.value;
  txAccount.innerHTML =
    banks.map((b) => `<option value="${b}">${b}</option>`).join('') +
    `<option value="__custom__">+ Outro banco ou conta...</option>`;
  if (banks.includes(currentModalVal)) {
    txAccount.value = currentModalVal;
  }

  // Atualiza opções nos MultiSelects de Banco
  ['bankFilter', 'payoffBankFilter', 'tabFilterBank'].forEach((id) => {
    if (multiSelectInstances[id]) {
      multiSelectInstances[id].setOptions(banks.map((b) => ({ value: b, label: b })));
    }
  });
}

function getPeriodTransactions() {
  return transactions.filter((t) => {
    const sameYear = Number(t.year) === Number(selectedYear);
    if (!sameYear) return false;
    if (selectedMonth === 'all') return true;
    return t.month === selectedMonth;
  });
}

function getMainFilteredTransactions() {
  const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
  const typeFilter = document.getElementById('typeFilter')?.value || 'all';
  const catFilter = getSelectedFilterValues('categoryFilter');
  const bankFilter = getSelectedFilterValues('bankFilter');

  return getPeriodTransactions().filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery) ||
      t.account.toLowerCase().includes(searchQuery);
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesCat = catFilter.length === 0 || catFilter.includes(t.category);
    const matchesBank = bankFilter.length === 0 || bankFilter.includes(t.account);
    return matchesSearch && matchesType && matchesCat && matchesBank;
  });
}

function hasActiveMainFilter() {
  const searchQuery = document.getElementById('searchInput').value.trim();
  const typeFilter = document.getElementById('typeFilter')?.value || 'all';
  const catFilter = getSelectedFilterValues('categoryFilter');
  const bankFilter = getSelectedFilterValues('bankFilter');
  return searchQuery !== '' || typeFilter !== 'all' || catFilter.length > 0 || bankFilter.length > 0;
}

function calculateSummary(list) {
  const incomeList = list.filter((t) => t.type === 'income');
  const expenseList = list.filter((t) => t.type === 'expense');

  // Apenas despesas em aberto (não pagas / pendentes) entram no total de Despesas a pagar (quanto devo)
  const openExpenseList = expenseList.filter((t) => !t.isPaid);
  const paidExpenseList = expenseList.filter((t) => Boolean(t.isPaid));

  const income = incomeList.reduce((acc, t) => acc + t.amount, 0);
  const expenses = openExpenseList.reduce((acc, t) => acc + t.amount, 0); // quanto eu devo (em aberto)
  const paidExpenses = paidExpenseList.reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = expenseList.reduce((acc, t) => acc + t.amount, 0); // total do mês (mesmo que já pagas)
  const netSavings = income - expenses;
  const savingsRate = income > 0 ? Math.round((netSavings / income) * 100) : 0;

  const byCategory = {};
  openExpenseList.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  return {
    income,
    expenses,
    paidExpenses,
    totalExpenses,
    netSavings,
    savingsRate,
    incomeCount: incomeList.length,
    expenseCount: openExpenseList.length,
    paidExpenseCount: paidExpenseList.length,
    totalExpenseCount: expenseList.length,
    byCategory
  };
}

function renderKPIs() {
  const filteredList = getMainFilteredTransactions();
  const {
    income,
    expenses,
    paidExpenses,
    totalExpenses,
    totalExpenseCount,
    netSavings,
    savingsRate,
    incomeCount,
    expenseCount,
    paidExpenseCount
  } = calculateSummary(filteredList);
  const isFiltered = hasActiveMainFilter();

  document.getElementById('kpiIncomeLabel').textContent = isFiltered ? 'Receitas (Filtro Aplicado)' : 'Receitas no Período';
  document.getElementById('kpiExpensesLabel').textContent = isFiltered ? 'Despesas a Pagar (Devo)' : 'Despesas no Período (Devo)';
  document.getElementById('kpiBalanceLabel').textContent = isFiltered ? 'Total de Despesas (Filtro)' : 'Total do Mês (Despesas)';

  document.getElementById('kpiIncome').textContent = formatBRL(income);
  document.getElementById('kpiIncomeCount').textContent = `${incomeCount} entrada(s) ${isFiltered ? 'no filtro' : 'no período'}`;

  document.getElementById('kpiExpenses').textContent = formatBRL(expenses);
  document.getElementById('kpiExpenseSubtext').textContent =
    paidExpenseCount > 0
      ? `${expenseCount} em aberto (${formatBRL(paidExpenses)} já pagos)`
      : `${expenseCount} em aberto ${isFiltered ? 'no filtro' : 'no período'}`;

  // Card 3: Substitui o balanço antigo pelo Total do Mês (mostra o total mesmo de contas já pagas)
  const totalMonthEl = document.getElementById('kpiSavingsAmount');
  totalMonthEl.textContent = formatBRL(totalExpenses);
  totalMonthEl.className = 'kpi-value';
  document.getElementById('kpiSavingsRate').textContent =
    `${totalExpenseCount} conta(s) no total (${paidExpenseCount} pagas, ${expenseCount} a pagar)`;

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

function getInstallmentGroupStats(tx) {
  if (!tx.isInstallment) return null;
  const groupItems = tx.groupId
    ? transactions.filter((t) => t.groupId === tx.groupId)
    : [tx];

  const totalCount = groupItems.length || tx.totalInstallments || 1;
  const paidItems = groupItems.filter((t) => t.isPaid);
  const pendingItems = groupItems.filter((t) => !t.isPaid);
  const totalAmount = groupItems.reduce((acc, t) => acc + t.amount, 0);
  const paidAmount = paidItems.reduce((acc, t) => acc + t.amount, 0);
  const remainingAmount = pendingItems.reduce((acc, t) => acc + t.amount, 0);

  return {
    groupItems,
    totalCount,
    paidCount: paidItems.length,
    pendingCount: pendingItems.length,
    totalAmount,
    paidAmount,
    remainingAmount
  };
}

function createTransactionCardHTML(tx, selectionContext = '') {
  const isIncome = tx.type === 'income';
  const bankColor = BANK_COLORS[tx.account] || '#6366f1';
  const isPaid = Boolean(tx.isPaid);

  let pct = tx.isInstallment
    ? Math.round((tx.installmentNumber / tx.totalInstallments) * 100)
    : 100;

  let groupExtraMeta = '';
  if (tx.isInstallment) {
    const stats = getInstallmentGroupStats(tx);
    if (stats) {
      groupExtraMeta = `<span class="tx-card-meta">• Pagas: <strong>${stats.paidCount}/${stats.totalCount}</strong> • Falta quitar: <strong>${formatBRL(stats.remainingAmount)}</strong></span>`;
    }
  }

  const modalityBadge = tx.isInstallment
    ? `<span class="badge-installment">Parcela ${tx.installmentNumber}/${tx.totalInstallments} (${pct}%)</span>`
    : `<span class="badge-avista">À vista</span>`;

  const paidStatusBadge = tx.isInstallment || isPaid
    ? isPaid
      ? `<span class="badge-paid">✅ Paga / Adiantada</span>`
      : `<span class="badge-pending">⏳ Pendente</span>`
    : '';

  const detailButton = tx.isInstallment
    ? `<button type="button" class="btn-action" data-detail-id="${tx.id}" title="Ver todas as parcelas, simular adiantamento ou quitar tudo">📋 Parcelas / Adiantar</button>`
    : '';

  const quickPayButton = !isIncome
    ? `<button type="button" class="btn-action" data-quick-toggle-paid-id="${tx.id}" title="${isPaid ? 'Voltar para Em Aberto' : 'Marcar esta despesa como Paga'}">${isPaid ? '↩️ Em aberto' : '✅ Pagar'}</button>`
    : '';

  const barColorClass = isPaid
    ? 'fill-emerald'
    : isIncome
    ? 'fill-emerald'
    : tx.isInstallment
    ? 'fill-indigo'
    : 'fill-amber';

  // Permite selecionar mais de uma dívida (checkbox) em Parcelamentos no Período e Filtros & Contas
  let checkboxHTML = '';
  let isSelectedForPay = false;
  if (selectionContext === 'period' && !isIncome) {
    isSelectedForPay = selectedPeriodTxIds.has(tx.id);
    checkboxHTML = `
      <label class="tx-select-chk-wrap" title="Marcar esta dívida para pagar junto com outras">
        <input type="checkbox" class="tx-select-chk" data-period-chk-id="${tx.id}" ${isSelectedForPay ? 'checked' : ''} />
      </label>
    `;
  } else if (selectionContext === 'filterTab' && !isIncome) {
    isSelectedForPay = selectedFilterTabTxIds.has(tx.id);
    checkboxHTML = `
      <label class="tx-select-chk-wrap" title="Marcar esta dívida para pagar junto com outras">
        <input type="checkbox" class="tx-select-chk" data-filtertab-chk-id="${tx.id}" ${isSelectedForPay ? 'checked' : ''} />
      </label>
    `;
  }

  return `
    <div class="tx-card ${tx.isInstallment ? 'clickable-installment' : ''} ${isPaid ? 'paid-card' : ''} ${isSelectedForPay ? 'selected-for-pay' : ''}" ${tx.isInstallment ? `data-card-detail-id="${tx.id}"` : ''}>
      <div class="tx-card-top">
        <div class="tx-card-main">
          ${checkboxHTML}
          <span class="tx-card-title">${tx.description}</span>
          ${modalityBadge}
          ${paidStatusBadge}
          <span class="badge-category">${tx.category}</span>
          <span class="badge-bank" style="background: ${bankColor}">${tx.account}</span>
          <span class="tx-card-meta">• ${formatPeriodLabel(tx.periodKey)}</span>
          ${groupExtraMeta}
        </div>
        <div class="tx-card-right">
          <span class="tx-card-amount ${isIncome ? 'positive-text' : 'negative-text'}">
            ${isIncome ? '+' : '-'} ${formatBRL(tx.amount)}
          </span>
          <div class="tx-card-actions">
            ${quickPayButton}
            ${detailButton}
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

function updatePeriodBatchPayBar() {
  const existingIds = new Set(transactions.map((t) => t.id));
  selectedPeriodTxIds.forEach((id) => {
    if (!existingIds.has(id)) selectedPeriodTxIds.delete(id);
  });

  const selectedItems = transactions.filter((t) => selectedPeriodTxIds.has(t.id));
  const totalSelected = selectedItems.reduce((acc, t) => acc + t.amount, 0);

  const infoEl = document.getElementById('periodSelectedInfoText');
  const totalEl = document.getElementById('periodSelectedTotalAmount');

  if (infoEl) {
    infoEl.textContent =
      selectedItems.length > 0
        ? `${selectedItems.length} dívida(s) marcada(s) para pagar juntas`
        : 'Marque a caixinha em 1 ou mais dívidas abaixo para pagar juntas';
  }
  if (totalEl) {
    totalEl.textContent = `Total selecionado: ${formatBRL(totalSelected)}`;
  }
}

function getPeriodSummaryInstallmentsList() {
  const hidePaid = document.getElementById('chkHidePaidInstallments')?.checked;
  const scope = document.getElementById('instViewScope')?.value || 'period';

  const searchQuery = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('typeFilter')?.value || 'all';
  const catFilter = getSelectedFilterValues('categoryFilter');
  const bankFilter = getSelectedFilterValues('bankFilter');

  const matchesMainFilters = (t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchQuery) ||
      t.account.toLowerCase().includes(searchQuery);
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesCat = catFilter.length === 0 || catFilter.includes(t.category);
    const matchesBank = bankFilter.length === 0 || bankFilter.includes(t.account);
    return matchesSearch && matchesType && matchesCat && matchesBank;
  };

  if (scope === 'all_pending') {
    const list = transactions
      .filter((t) => t.isInstallment && (!hidePaid || !t.isPaid) && matchesMainFilters(t))
      .sort((a, b) => (a.periodKey || '').localeCompare(b.periodKey || '') || a.installmentNumber - b.installmentNumber);
    return { list, usedFallback: false };
  }

  if (scope === 'next_each') {
    const groups = getGroupedInstallmentDebts();
    const list = groups
      .map((g) => (g.pendingItems.length > 0 ? g.pendingItems[0] : g.items[g.items.length - 1]))
      .filter((t) => t && (!hidePaid || !t.isPaid) && matchesMainFilters(t));
    return { list, usedFallback: false };
  }

  // scope === 'period'
  const periodList = getMainFilteredTransactions()
    .filter((t) => t.isInstallment && (!hidePaid || !t.isPaid))
    .sort((a, b) => (b.periodKey || '').localeCompare(a.periodKey || '') || b.id - a.id);

  if (periodList.length > 0) {
    return { list: periodList, usedFallback: false };
  }

  // Se não houver parcelas no mês selecionado (ou todas do mês foram ocultadas), mas existirem parcelamentos ativos em outros meses, mostra a próxima parcela de cada dívida ativa!
  const groups = getGroupedInstallmentDebts();
  const fallbackList = groups
    .map((g) => (g.pendingItems.length > 0 ? g.pendingItems[0] : (!hidePaid ? g.items[g.items.length - 1] : null)))
    .filter((t) => t && (!hidePaid || !t.isPaid) && matchesMainFilters(t));

  return { list: fallbackList, usedFallback: fallbackList.length > 0 };
}

function renderInstallmentsSummary() {
  const container = document.getElementById('installmentsSummaryList');
  if (!container) return;

  const { list: periodList, usedFallback } = getPeriodSummaryInstallmentsList();

  updatePeriodBatchPayBar();

  if (periodList.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma parcela ativa para mostrar neste período/filtro (R$ 0,00).</p>`;
    return;
  }

  const periodLabel =
    selectedMonth === 'all'
      ? `${selectedYear}`
      : `${MONTH_NAMES[selectedMonth]}/${selectedYear}`;

  const fallbackBanner = usedFallback
    ? `<div class="agent-live-preview" style="margin-bottom: 6px;">ℹ️ Nenhuma parcela pendente com vencimento exato em <strong>${periodLabel}</strong> — exibindo abaixo a próxima parcela de cada um dos seus <strong>${periodList.length} parcelamento(s) ativo(s)</strong>:</div>`
    : '';

  container.innerHTML =
    fallbackBanner + periodList.map((t) => createTransactionCardHTML(t, 'period')).join('');
}

function renderTransactionsList() {
  const container = document.getElementById('transactionsListContainer');
  const filtered = getMainFilteredTransactions().sort(
    (a, b) => (b.periodKey || '').localeCompare(a.periodKey || '') || b.id - a.id
  );

  renderKPIs();
  renderCategoryBreakdown();
  renderInstallmentsSummary();

  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma transação ou conta encontrada com este filtro (R$ 0,00).</p>`;
    return;
  }

  container.innerHTML = filtered.map((t) => createTransactionCardHTML(t, '')).join('');
}

/**
 * Agrupa todas as contas parceladas (dívidas) para a Central "Quitar Dívidas"
 */
function getGroupedInstallmentDebts() {
  const installmentTxs = transactions.filter((t) => t.isInstallment);
  const groupsMap = new Map();

  installmentTxs.forEach((tx) => {
    const key = tx.groupId || `single_inst_${tx.id}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key).push(tx);
  });

  const debtGroups = [];
  groupsMap.forEach((items, groupKey) => {
    const sortedItems = [...items].sort((a, b) => a.installmentNumber - b.installmentNumber);
    const first = sortedItems[0];
    const last = sortedItems[sortedItems.length - 1];
    const paidItems = sortedItems.filter((i) => i.isPaid);
    const pendingItems = sortedItems.filter((i) => !i.isPaid);

    const totalAmount = sortedItems.reduce((acc, i) => acc + i.amount, 0);
    const paidAmount = paidItems.reduce((acc, i) => acc + i.amount, 0);
    const remainingAmount = pendingItems.reduce((acc, i) => acc + i.amount, 0);

    debtGroups.push({
      groupKey,
      representativeId: first.id,
      name: first.baseDescription || first.description,
      account: first.account,
      category: first.category,
      parcelAmount: first.amount,
      totalCount: sortedItems.length,
      paidCount: paidItems.length,
      pendingCount: pendingItems.length,
      totalAmount,
      paidAmount,
      remainingAmount,
      firstPeriodKey: first.periodKey,
      lastPeriodKey: last.periodKey,
      items: sortedItems,
      pendingItems
    });
  });

  return debtGroups.sort((a, b) => b.remainingAmount - a.remainingAmount || b.representativeId - a.representativeId);
}

function hasActivePayoffFilter() {
  const searchQ = (document.getElementById('payoffSearchInput')?.value || '').trim();
  const bankF = getSelectedFilterValues('payoffBankFilter');
  const catF = getSelectedFilterValues('payoffCategoryFilter');
  const statusF = document.getElementById('payoffStatusFilter')?.value || 'pending';
  return searchQ !== '' || bankF.length > 0 || catF.length > 0 || statusF !== 'pending';
}

function getFilteredPayoffDebtGroups() {
  const allDebtGroups = getGroupedInstallmentDebts();
  const searchQ = (document.getElementById('payoffSearchInput')?.value || '').toLowerCase().trim();
  const bankF = getSelectedFilterValues('payoffBankFilter');
  const catF = getSelectedFilterValues('payoffCategoryFilter');
  const statusF = document.getElementById('payoffStatusFilter')?.value || 'pending';

  return allDebtGroups.filter((g) => {
    if (statusF === 'pending' && g.pendingCount === 0) return false;
    if (bankF.length > 0 && !bankF.includes(g.account)) return false;
    if (catF.length > 0 && !catF.includes(g.category)) return false;
    if (
      searchQ &&
      !g.name.toLowerCase().includes(searchQ) &&
      !g.account.toLowerCase().includes(searchQ) &&
      !g.category.toLowerCase().includes(searchQ)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Renderiza a Aba 2: Central "Quitar Dívidas — Contas Parceladas" (#viewQuitarDividas)
 * Todos os cartões (Contas Ativas, Total Já Pago, Falta Quitar e Total Selecionado) puxam do mesmo filtro ativo!
 */
function renderPayoffDebtsView() {
  const existingIds = new Set(transactions.filter((t) => t.isInstallment).map((t) => t.id));
  selectedPayoffTxIds.forEach((id) => {
    if (!existingIds.has(id)) selectedPayoffTxIds.delete(id);
  });

  const filteredGroups = getFilteredPayoffDebtGroups();
  const isFiltered = hasActivePayoffFilter();

  // IDs de parcelas que pertencem às dívidas do filtro atual
  const filteredItemIds = new Set(filteredGroups.flatMap((g) => g.items.map((i) => i.id)));

  const activeDebts = filteredGroups.filter((g) => g.pendingCount > 0);
  const totalPendingParcels = filteredGroups.reduce((acc, g) => acc + g.pendingCount, 0);
  const totalPaidParcels = filteredGroups.reduce((acc, g) => acc + g.paidCount, 0);
  const totalPaidAmount = filteredGroups.reduce((acc, g) => acc + g.paidAmount, 0);
  const totalRemainingAmount = filteredGroups.reduce((acc, g) => acc + g.remainingAmount, 0);

  // Calcula quantas dívidas e parcelas estão marcadas DENTRO do filtro atual
  const selectedTxObjects = transactions.filter(
    (t) => selectedPayoffTxIds.has(t.id) && filteredItemIds.has(t.id)
  );
  const selectedTotalValue = selectedTxObjects.reduce((acc, t) => acc + t.amount, 0);
  const selectedDebtsSet = new Set(selectedTxObjects.map((t) => t.groupId || `single_inst_${t.id}`));

  const activeLabelEl = document.getElementById('payoffKpiActiveLabel');
  const paidLabelEl = document.getElementById('payoffKpiPaidLabel');
  const remainingLabelEl = document.getElementById('payoffKpiRemainingLabel');
  const selectedLabelEl = document.getElementById('payoffKpiSelectedLabel');

  if (activeLabelEl) {
    activeLabelEl.textContent = isFiltered ? 'Contas Parceladas (Filtro)' : 'Contas Parceladas Ativas';
  }
  if (paidLabelEl) {
    paidLabelEl.textContent = isFiltered ? 'Total Já Pago (Filtro)' : 'Total Já Pago / Adiantado';
  }
  if (remainingLabelEl) {
    remainingLabelEl.textContent = isFiltered ? 'Falta Quitar (Filtro Aplicado)' : 'Falta Quitar (Todas as Dívidas)';
  }
  if (selectedLabelEl) {
    selectedLabelEl.textContent = isFiltered ? 'Total Selecionado (Filtro)' : 'Total Selecionado para Quitar';
  }

  document.getElementById('payoffKpiActiveCount').textContent = `${activeDebts.length} dívida(s)`;
  document.getElementById('payoffKpiActiveSub').textContent = `${totalPendingParcels} parcela(s) pendente(s) ${isFiltered ? 'no filtro' : 'no total'}`;

  document.getElementById('payoffKpiTotalPaid').textContent = formatBRL(totalPaidAmount);
  document.getElementById('payoffKpiPaidSub').textContent = `${totalPaidParcels} parcela(s) já quitada(s) ${isFiltered ? 'no filtro' : ''}`;

  document.getElementById('payoffKpiTotalRemaining').textContent = formatBRL(totalRemainingAmount);
  document.getElementById('payoffKpiRemainingSub').textContent = isFiltered
    ? 'Soma restante das dívidas filtradas'
    : 'Soma restante de todos os parcelamentos';

  document.getElementById('payoffKpiSelectedTotal').textContent = formatBRL(selectedTotalValue);
  document.getElementById('payoffKpiSelectedSub').textContent = `${selectedDebtsSet.size} dívida(s) / ${selectedTxObjects.length} parcela(s) marcada(s)`;

  document.getElementById('payoffBarSummaryText').textContent =
    selectedTxObjects.length > 0
      ? `Selecionado no filtro: ${selectedDebtsSet.size} dívida(s) (${selectedTxObjects.length} parcela(s) marcada(s))`
      : 'Marque 1, 2 ou mais dívidas (ou parcelas específicas) abaixo para somar e pagar de uma vez';
  document.getElementById('payoffBarTotalValue').textContent = `Valor p/ pagar: ${formatBRL(selectedTotalValue)}`;

  const container = document.getElementById('payoffDebtsContainer');
  if (filteredGroups.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma conta parcelada encontrada para este filtro (R$ 0,00).</p>`;
    return;
  }

  container.innerHTML = filteredGroups
    .map((group) => {
      const bankColor = BANK_COLORS[group.account] || '#6366f1';
      const paidPct = group.totalCount > 0 ? Math.round((group.paidCount / group.totalCount) * 100) : 0;

      // Verifica quantas parcelas desta dívida estão selecionadas
      const selectedInGroup = group.items.filter((i) => selectedPayoffTxIds.has(i.id));
      const selectedAmountInGroup = selectedInGroup.reduce((acc, i) => acc + i.amount, 0);
      const allPendingSelected =
        group.pendingItems.length > 0 &&
        group.pendingItems.every((i) => selectedPayoffTxIds.has(i.id));

      const parcelsChipsHTML = group.items
        .map((item) => {
          const isPaid = Boolean(item.isPaid);
          const isChecked = selectedPayoffTxIds.has(item.id);
          return `
            <label class="debt-parcel-chip ${isPaid ? 'chip-paid' : ''} ${isChecked ? 'chip-selected' : ''}" title="Clique para marcar/desmarcar esta parcela">
              <input type="checkbox" class="debt-pill-chk" data-payoff-tx-id="${item.id}" ${isChecked ? 'checked' : ''} />
              <span><strong>${item.installmentNumber}/${item.totalInstallments}</strong> (${formatPeriodLabel(item.periodKey)})</span>
              <span>${formatBRL(item.amount)}</span>
              <span>${isPaid ? '✅' : '⏳'}</span>
            </label>
          `;
        })
        .join('');

      return `
        <div class="debt-group-card ${selectedInGroup.length > 0 ? 'debt-selected' : ''}">
          <div class="debt-group-top">
            <div class="debt-group-title-area">
              <label class="tx-select-chk-wrap" title="Marcar todas as parcelas pendentes desta dívida">
                <input type="checkbox" class="debt-group-chk" data-payoff-group-key="${group.groupKey}" ${allPendingSelected ? 'checked' : ''} />
              </label>
              <span class="debt-group-name" data-detail-id="${group.representativeId}">${group.name}</span>
              <span class="badge-bank" style="background: ${bankColor}">${group.account}</span>
              <span class="badge-category">${group.category}</span>
              <span class="tx-card-meta">• ${formatPeriodLabel(group.firstPeriodKey)} até ${formatPeriodLabel(group.lastPeriodKey)}</span>
            </div>

            <div class="tx-card-actions">
              <button type="button" class="btn-icon-sm" data-select-next-group="${group.groupKey}" title="Marcar apenas a próxima parcela pendente desta dívida">
                + 1ª Pendente (${formatBRL(group.parcelAmount)})
              </button>
              <button type="button" class="btn-icon-sm" data-select-all-group="${group.groupKey}" title="Marcar todas as parcelas pendentes desta dívida para quitar">
                Marcar Quitação (${formatBRL(group.remainingAmount)})
              </button>
              <button type="button" class="btn-action" data-detail-id="${group.representativeId}">
                📋 Detalhes
              </button>
            </div>
          </div>

          <div class="debt-group-stats-row">
            <div class="debt-stat-pill">
              <small>Total da Compra (${group.totalCount}x)</small>
              <strong>${formatBRL(group.totalAmount)}</strong>
            </div>
            <div class="debt-stat-pill">
              <small>Já Pago (${group.paidCount}/${group.totalCount})</small>
              <strong class="positive-text">${formatBRL(group.paidAmount)}</strong>
            </div>
            <div class="debt-stat-pill">
              <small>Falta Quitar (${group.pendingCount}x)</small>
              <strong class="negative-text">${formatBRL(group.remainingAmount)}</strong>
            </div>
            <div class="debt-stat-pill">
              <small>Marcado nesta dívida (${selectedInGroup.length}x)</small>
              <strong class="positive-text">${formatBRL(selectedAmountInGroup)}</strong>
            </div>
          </div>

          <div class="progress-bar">
            <div class="progress-fill fill-emerald" style="width: ${paidPct}%"></div>
          </div>

          <div class="debt-parcels-grid">
            ${parcelsChipsHTML}
          </div>
        </div>
      `;
    })
    .join('');
}

function updateFilterTabBatchPayBar() {
  const existingIds = new Set(transactions.map((t) => t.id));
  selectedFilterTabTxIds.forEach((id) => {
    if (!existingIds.has(id)) selectedFilterTabTxIds.delete(id);
  });

  const selectedItems = transactions.filter((t) => selectedFilterTabTxIds.has(t.id));
  const totalSelected = selectedItems.reduce((acc, t) => acc + t.amount, 0);

  const infoEl = document.getElementById('filterTabSelectedInfoText');
  const totalEl = document.getElementById('filterTabSelectedTotalAmount');

  if (infoEl) {
    infoEl.textContent =
      selectedItems.length > 0
        ? `${selectedItems.length} dívida(s) marcada(s) no filtro para pagar juntas`
        : 'Marque 1 ou mais dívidas na lista abaixo para pagar juntas';
  }
  if (totalEl) {
    totalEl.textContent = `Total selecionado: ${formatBRL(totalSelected)}`;
  }
}

function getFilteredTabTransactionsList() {
  const fType = document.getElementById('tabFilterType')?.value || 'all';
  const fMonth = document.getElementById('tabFilterMonth').value;
  const fYear = document.getElementById('tabFilterYear').value;
  const fBank = getSelectedFilterValues('tabFilterBank');
  const fCategory = getSelectedFilterValues('tabFilterCategory');
  const fModality = document.getElementById('tabFilterModality').value;
  const fStatus = document.getElementById('tabFilterStatus')?.value || 'all';
  const fSearch = document.getElementById('tabFilterSearch').value.toLowerCase().trim();

  return transactions
    .filter((t) => {
      if (fType !== 'all' && t.type !== fType) return false;
      if (fYear !== 'all' && String(t.year) !== String(fYear)) return false;
      if (fMonth !== 'all' && t.month !== fMonth) return false;
      if (fBank.length > 0 && !fBank.includes(t.account)) return false;
      if (fCategory.length > 0 && !fCategory.includes(t.category)) return false;
      if (fModality === 'installment' && !t.isInstallment) return false;
      if (fModality === 'single' && t.isInstallment) return false;
      if (fStatus === 'open' && Boolean(t.isPaid)) return false;
      if (fStatus === 'paid' && !t.isPaid) return false;
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
}

/**
 * Renderiza a Aba "Filtros & Contas" (#viewFiltros), incluindo o Saldo Acumulado Geral e o Filtro de Receita/Despesa
 */
function renderFilterTabView() {
  const fType = document.getElementById('tabFilterType')?.value || 'all';
  const fMonth = document.getElementById('tabFilterMonth').value;
  const fYear = document.getElementById('tabFilterYear').value;
  const fBank = document.getElementById('tabFilterBank').value;

  const filtered = getFilteredTabTransactionsList();

  // Saldo Acumulado Geral (soma de todas as receitas menos todas as despesas em aberto)
  const allSummary = calculateSummary(transactions);
  const totalBalEl = document.getElementById('kpiTotalBalance');
  totalBalEl.textContent = formatBRL(allSummary.netSavings);
  totalBalEl.className = `kpi-value ${allSummary.netSavings > 0 ? 'positive-text' : allSummary.netSavings < 0 ? 'negative-text' : ''}`;

  const { income, expenses, paidExpenses, netSavings, savingsRate, incomeCount, expenseCount, paidExpenseCount } = calculateSummary(filtered);

  const typeLabel =
    fType === 'income' ? 'Receitas' : fType === 'expense' ? 'Despesas' : 'Receitas + Despesas';
  const monthLabel = fMonth === 'all' ? 'Todos os meses' : MONTH_NAMES[fMonth];
  const yearLabel = fYear === 'all' ? 'Todos os anos' : fYear;
  const fBankList = getSelectedFilterValues('tabFilterBank');
  const fCatList = getSelectedFilterValues('tabFilterCategory');
  const bankLabel = fBankList.length === 0 ? 'Todos os bancos' : fBankList.join(', ');
  const catLabel = fCatList.length === 0 ? 'Todas as categorias' : fCatList.join(', ');
  document.getElementById('tabKpiFilterSummary').textContent = `${filtered.length} item(ns) (${typeLabel} • ${monthLabel}/${yearLabel} • ${bankLabel} • ${catLabel})`;

  document.getElementById('tabKpiIncome').textContent = formatBRL(income);
  document.getElementById('tabKpiIncomeSub').textContent = `${incomeCount} entrada(s) no filtro`;

  document.getElementById('tabKpiExpenses').textContent = formatBRL(expenses);
  document.getElementById('tabKpiExpenseSub').textContent =
    paidExpenseCount > 0
      ? `${expenseCount} em aberto (Já pago: ${formatBRL(paidExpenses)})`
      : `${expenseCount} em aberto no filtro`;

  const balEl = document.getElementById('tabKpiBalance');
  balEl.textContent = formatBRL(netSavings);
  balEl.className = `kpi-value ${netSavings > 0 ? 'positive-text' : netSavings < 0 ? 'negative-text' : ''}`;
  document.getElementById('tabKpiSavingsRate').textContent = `Taxa de economia no filtro: ${savingsRate}%`;

  updateFilterTabBatchPayBar();

  const container = document.getElementById('tabFilteredListContainer');
  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-state">Nenhuma transação ou conta encontrada para os filtros selecionados (R$ 0,00).</p>`;
    return;
  }

  container.innerHTML = filtered.map((t) => createTransactionCardHTML(t, 'filterTab')).join('');
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
  renderPayoffDebtsView();
  renderFilterTabView();
}

/**
 * Executa o pagamento / quitação em lote para qualquer conjunto de IDs selecionados
 */
function executeBatchPayForIds(idsSet, advanceMode) {
  if (!idsSet || idsSet.size === 0) {
    alert('Selecione ao menos uma dívida ou parcela antes de confirmar o pagamento.');
    return false;
  }

  const targetItems = transactions.filter((t) => idsSet.has(t.id));
  const totalPaid = targetItems.reduce((acc, t) => acc + t.amount, 0);
  const countPaid = targetItems.length;

  const currentM = selectedMonth === 'all' ? '10' : selectedMonth;
  const currentPeriodKey = `${selectedYear}-${currentM}`;

  if (advanceMode === 'remove_paid') {
    transactions = transactions.filter((t) => !idsSet.has(t.id));
    if (idsSet.has(activeDetailTxId)) {
      const remaining = transactions.find((t) => t.isInstallment);
      activeDetailTxId = remaining ? remaining.id : null;
    }
  } else {
    transactions.forEach((t) => {
      if (idsSet.has(t.id)) {
        t.isPaid = true;
        if (advanceMode === 'move_to_current') {
          t.year = selectedYear;
          t.month = currentM;
          t.periodKey = currentPeriodKey;
        }
      }
    });
  }

  idsSet.clear();
  saveTransactions();
  refreshDashboard();

  showAgentFeedback(
    `✅ <strong>Pagamento confirmado!</strong> ${countPaid} dívida(s)/parcela(s) no total de <strong>${formatBRL(totalPaid)}</strong> foram quitadas com sucesso.`,
    false
  );
  return true;
}

let activeDetailTxId = null;

function handleCardActionClick(e) {
  // Evita abrir o modal quando clicou diretamente no checkbox de seleção múltipla
  if (e.target.closest('.tx-select-chk-wrap') || e.target.classList.contains('tx-select-chk')) {
    return;
  }

  const quickToggleBtn = e.target.closest('[data-quick-toggle-paid-id]');
  if (quickToggleBtn) {
    const id = Number(quickToggleBtn.getAttribute('data-quick-toggle-paid-id'));
    const target = transactions.find((t) => t.id === id);
    if (target) {
      target.isPaid = !target.isPaid;
      saveTransactions();
      refreshDashboard();
    }
    return;
  }

  const detailBtn = e.target.closest('[data-detail-id]');
  if (detailBtn) {
    const id = Number(detailBtn.getAttribute('data-detail-id'));
    openInstallmentDetailModal(id);
    return;
  }

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
    return;
  }

  // Clicar no cartão de uma parcela abre a visualização detalhada de todas as parcelas
  const cardDetail = e.target.closest('[data-card-detail-id]');
  if (cardDetail) {
    const id = Number(cardDetail.getAttribute('data-card-detail-id'));
    openInstallmentDetailModal(id);
  }
}

function openInstallmentDetailModal(txId) {
  const tx = transactions.find((t) => t.id === txId);
  if (!tx) return;

  activeDetailTxId = tx.id;
  renderInstallmentDetailModalContent();
  document.getElementById('installmentDetailModal').classList.remove('hidden');
}

function renderInstallmentDetailModalContent() {
  const tx = transactions.find((t) => t.id === activeDetailTxId);
  if (!tx) {
    document.getElementById('installmentDetailModal').classList.add('hidden');
    return;
  }

  const stats = getInstallmentGroupStats(tx);
  if (!stats) return;

  const sortedGroup = [...stats.groupItems].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const titleName = tx.baseDescription || tx.description;

  document.getElementById('instModalTitle').textContent = `Parcelamento: ${titleName}`;
  document.getElementById('instModalSubtitle').textContent = `Banco/Conta: ${tx.account} • Categoria: ${tx.category}`;

  document.getElementById('instStatTotal').textContent = formatBRL(stats.totalAmount);
  document.getElementById('instStatTotalSub').textContent = `${stats.totalCount}x de ${formatBRL(tx.amount)}`;

  document.getElementById('instStatPaid').textContent = formatBRL(stats.paidAmount);
  document.getElementById('instStatPaidSub').textContent = `${stats.paidCount} de ${stats.totalCount} pagas`;

  document.getElementById('instStatRemaining').textContent = formatBRL(stats.remainingAmount);
  document.getElementById('instStatRemainingSub').textContent = `${stats.pendingCount} pendentes para quitar`;

  const paidPct = stats.totalCount > 0 ? Math.round((stats.paidCount / stats.totalCount) * 100) : 0;
  document.getElementById('instProgressText').textContent = `Progresso de quitação: ${paidPct}% (${stats.paidCount}/${stats.totalCount} pagas)`;
  document.getElementById('instProgressBar').style.width = `${paidPct}%`;

  const listContainer = document.getElementById('instAllParcelsList');
  listContainer.innerHTML = sortedGroup
    .map((item) => {
      const isPaid = Boolean(item.isPaid);
      const statusBadge = isPaid
        ? `<span class="badge-paid">✅ Paga / Adiantada</span>`
        : `<span class="badge-pending">⏳ Pendente</span>`;

      return `
        <div class="inst-parcel-item ${isPaid ? 'is-paid' : ''}">
          <label class="inst-parcel-left">
            <input type="checkbox" class="inst-select-chk" data-parcel-id="${item.id}" data-parcel-amount="${item.amount}" />
            <div>
              <strong>Parcela ${item.installmentNumber}/${item.totalInstallments}</strong>
              <span class="tx-card-meta">• Vencimento/Mês: ${formatPeriodLabel(item.periodKey)}</span>
            </div>
          </label>
          <div class="inst-parcel-right">
            ${statusBadge}
            <strong>${formatBRL(item.amount)}</strong>
            <button type="button" class="btn-icon-sm" data-toggle-paid-id="${item.id}">
              ${isPaid ? 'Desmarcar Paga' : 'Marcar Paga'}
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  updateInstallmentCalculator();
}

function updateInstallmentCalculator() {
  const checkedBoxes = Array.from(document.querySelectorAll('#instAllParcelsList .inst-select-chk:checked'));
  const count = checkedBoxes.length;
  const totalSelected = checkedBoxes.reduce((acc, chk) => acc + (parseFloat(chk.getAttribute('data-parcel-amount')) || 0), 0);

  document.getElementById('instSelectedCountText').textContent =
    count > 0
      ? `${count} parcela(s) selecionada(s) para pagar/adiantar:`
      : 'Marque abaixo as parcelas que deseja pagar ou adiantar:';

  document.getElementById('instSelectedTotalValue').textContent = `Valor selecionado: ${formatBRL(totalSelected)}`;
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

  const txAccountEl = document.getElementById('txAccount');
  txAccountEl.value = tx.account;
  if (txAccountEl.value !== tx.account) {
    const opt = document.createElement('option');
    opt.value = tx.account;
    opt.textContent = tx.account;
    txAccountEl.insertBefore(opt, txAccountEl.lastElementChild);
    txAccountEl.value = tx.account;
  }
  document.getElementById('customAccountGroup').classList.add('hidden');

  if (tx.isInstallment && tx.groupId) {
    // Ao editar parcelas: exibe escopo e campos com tipo de parcela e quantidade de vezes
    document.getElementById('paymentModeGroup').classList.add('hidden');
    document.getElementById('editScopeBox').classList.remove('hidden');
    document.getElementById('txEditScope').value = 'all';
    document.getElementById('installmentFields').classList.remove('hidden');

    const groupItems = transactions
      .filter((t) => t.groupId === tx.groupId)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);
    const firstItem = groupItems[0] || tx;

    document.getElementById('txStartMonth').value = firstItem.month;
    document.getElementById('txStartYear').value = firstItem.year;
    document.getElementById('txInstallments').value = String(tx.totalInstallments || groupItems.length || 2);
    document.getElementById('txValueMode').value = 'parcel';
    isInstallmentMode = true;
    updateInstallmentPreview();
  } else {
    // Permite parcelar uma transação que era à vista
    document.getElementById('txStartMonth').value = tx.month;
    document.getElementById('txStartYear').value = tx.year;
    document.getElementById('editScopeBox').classList.add('hidden');
    document.getElementById('paymentModeGroup').classList.remove('hidden');
    document.getElementById('txInstallments').value = '2';
    document.getElementById('txValueMode').value = 'total';
    document.getElementById('btnModeAvista').click();
    updateInstallmentPreview();
  }

  document.getElementById('transactionModal').classList.remove('hidden');
}

function switchActiveView(viewName) {
  uiPrefs.activeView = viewName || 'visao-geral';
  saveUiPrefs();

  const navItems = document.querySelectorAll('.nav-menu .nav-item');
  const viewVisaoGeral = document.getElementById('viewVisaoGeral');
  const viewQuitarDividas = document.getElementById('viewQuitarDividas');
  const viewFiltros = document.getElementById('viewFiltros');
  const topPeriodPicker = document.getElementById('topPeriodPicker');

  navItems.forEach((n) => {
    n.classList.toggle('active', n.getAttribute('data-view') === viewName);
  });

  viewVisaoGeral.classList.add('hidden');
  viewQuitarDividas.classList.add('hidden');
  viewFiltros.classList.add('hidden');

  if (viewName === 'quitar-dividas') {
    viewQuitarDividas.classList.remove('hidden');
    topPeriodPicker.classList.add('hidden');
    renderPayoffDebtsView();
  } else if (viewName === 'filtros') {
    viewFiltros.classList.remove('hidden');
    topPeriodPicker.classList.add('hidden');
    renderFilterTabView();
  } else {
    viewVisaoGeral.classList.remove('hidden');
    topPeriodPicker.classList.remove('hidden');
    refreshDashboard();
  }
}

/* Event Listeners */
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.setAttribute('data-theme', uiPrefs.theme === 'light' ? 'light' : 'dark');
  initAllMultiSelects();

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.multiselect-dropdown')) {
      document.querySelectorAll('.multiselect-dropdown.open').forEach((d) => {
        d.classList.remove('open');
        d.querySelector('.multiselect-menu')?.classList.add('hidden');
      });
    }
  });
  renderUserName();
  applyChartColors();

  // Restaurar escolhas fixas de layout e visualização
  const monthSelectEl = document.getElementById('monthSelector');
  if (monthSelectEl) monthSelectEl.value = selectedMonth;
  const tabFilterMonthEl = document.getElementById('tabFilterMonth');
  if (tabFilterMonthEl) tabFilterMonthEl.value = selectedMonth;
  document.getElementById('tabFilterYear').value = String(selectedYear);

  const chkHidePaidEl = document.getElementById('chkHidePaidInstallments');
  if (chkHidePaidEl) chkHidePaidEl.checked = Boolean(uiPrefs.hidePaidInstallments);

  const instViewScopeEl = document.getElementById('instViewScope');
  if (instViewScopeEl && uiPrefs.instViewScope) {
    instViewScopeEl.value = uiPrefs.instViewScope;
  }

  refreshDashboard();
  if (uiPrefs.activeView && uiPrefs.activeView !== 'visao-geral') {
    switchActiveView(uiPrefs.activeView);
  }

  // Seletores de cor do gráfico
  document.getElementById('colorPickerIncome').addEventListener('input', (e) => {
    chartColors.income = e.target.value;
    saveChartColors();
    applyChartColors();
  });

  document.getElementById('colorPickerExpense').addEventListener('input', (e) => {
    chartColors.expense = e.target.value;
    saveChartColors();
    applyChartColors();
  });

  document.getElementById('btnResetChartColors').addEventListener('click', () => {
    chartColors = { ...DEFAULT_CHART_COLORS };
    saveChartColors();
    applyChartColors();
  });

  // Alternar entre as abas da barra lateral: "Visão Geral", "Quitar Dívidas" e "Filtros & Contas"
  document.querySelectorAll('.nav-menu .nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchActiveView(item.getAttribute('data-view'));
    });
  });

  // Botão rápido na Visão Geral para abrir a Central Quitar Dívidas
  document.getElementById('btnGoToPayoffTab')?.addEventListener('click', () => {
    switchActiveView('quitar-dividas');
  });

  // ==========================================
  // EVENTOS: SELEÇÃO MÚLTIPLA EM "PARCELAMENTOS NO PERÍODO"
  // ==========================================
  document.getElementById('installmentsSummaryList')?.addEventListener('change', (e) => {
    const chk = e.target.closest('[data-period-chk-id]');
    if (!chk) return;
    const id = Number(chk.getAttribute('data-period-chk-id'));
    if (chk.checked) {
      selectedPeriodTxIds.add(id);
    } else {
      selectedPeriodTxIds.delete(id);
    }
    renderInstallmentsSummary();
  });

  document.getElementById('btnSelectAllPeriodInst')?.addEventListener('click', () => {
    const { list } = getPeriodSummaryInstallmentsList();
    list.filter((t) => !t.isPaid).forEach((t) => selectedPeriodTxIds.add(t.id));
    renderInstallmentsSummary();
  });

  document.getElementById('btnClearPeriodInst')?.addEventListener('click', () => {
    selectedPeriodTxIds.clear();
    renderInstallmentsSummary();
  });

  document.getElementById('btnPayPeriodSelected')?.addEventListener('click', () => {
    const mode = document.getElementById('periodBatchAdvanceMode').value;
    executeBatchPayForIds(selectedPeriodTxIds, mode);
  });

  // ==========================================
  // EVENTOS: CENTRAL "QUITAR DÍVIDAS — CONTAS PARCELADAS" (#viewQuitarDividas)
  // ==========================================
  ['payoffSearchInput', 'payoffBankFilter', 'payoffCategoryFilter', 'payoffStatusFilter'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', renderPayoffDebtsView);
    el.addEventListener('change', renderPayoffDebtsView);
  });

  document.getElementById('payoffDebtsContainer').addEventListener('change', (e) => {
    // 1. Marcar/desmarcar todas as parcelas pendentes de uma dívida inteira
    const groupChk = e.target.closest('[data-payoff-group-key]');
    if (groupChk) {
      const groupKey = groupChk.getAttribute('data-payoff-group-key');
      const group = getGroupedInstallmentDebts().find((g) => g.groupKey === groupKey);
      if (group) {
        const targets = group.pendingItems.length > 0 ? group.pendingItems : group.items;
        targets.forEach((item) => {
          if (groupChk.checked) {
            selectedPayoffTxIds.add(item.id);
          } else {
            selectedPayoffTxIds.delete(item.id);
          }
        });
        renderPayoffDebtsView();
      }
      return;
    }

    // 2. Marcar/desmarcar uma parcela individual dentro do cartão da dívida
    const pillChk = e.target.closest('[data-payoff-tx-id]');
    if (pillChk) {
      const txId = Number(pillChk.getAttribute('data-payoff-tx-id'));
      if (pillChk.checked) {
        selectedPayoffTxIds.add(txId);
      } else {
        selectedPayoffTxIds.delete(txId);
      }
      renderPayoffDebtsView();
    }
  });

  document.getElementById('payoffDebtsContainer').addEventListener('click', (e) => {
    const nextBtn = e.target.closest('[data-select-next-group]');
    if (nextBtn) {
      const groupKey = nextBtn.getAttribute('data-select-next-group');
      const group = getGroupedInstallmentDebts().find((g) => g.groupKey === groupKey);
      if (group && group.pendingItems.length > 0) {
        selectedPayoffTxIds.add(group.pendingItems[0].id);
        renderPayoffDebtsView();
      }
      return;
    }

    const allGroupBtn = e.target.closest('[data-select-all-group]');
    if (allGroupBtn) {
      const groupKey = allGroupBtn.getAttribute('data-select-all-group');
      const group = getGroupedInstallmentDebts().find((g) => g.groupKey === groupKey);
      if (group) {
        group.pendingItems.forEach((i) => selectedPayoffTxIds.add(i.id));
        renderPayoffDebtsView();
      }
      return;
    }

    const detailBtn = e.target.closest('[data-detail-id]');
    if (detailBtn) {
      const id = Number(detailBtn.getAttribute('data-detail-id'));
      openInstallmentDetailModal(id);
    }
  });

  document.getElementById('btnPayoffSelectAllRemaining').addEventListener('click', () => {
    getFilteredPayoffDebtGroups().forEach((g) => {
      g.pendingItems.forEach((i) => selectedPayoffTxIds.add(i.id));
    });
    renderPayoffDebtsView();
  });

  document.getElementById('btnPayoffSelectNextInstallmentEach').addEventListener('click', () => {
    selectedPayoffTxIds.clear();
    getFilteredPayoffDebtGroups().forEach((g) => {
      if (g.pendingItems.length > 0) {
        selectedPayoffTxIds.add(g.pendingItems[0].id);
      }
    });
    renderPayoffDebtsView();
  });

  document.getElementById('btnPayoffClearSelection').addEventListener('click', () => {
    selectedPayoffTxIds.clear();
    renderPayoffDebtsView();
  });

  document.getElementById('btnExecuteMultiPayoff').addEventListener('click', () => {
    const mode = document.getElementById('payoffBatchMode').value;
    const filteredGroups = getFilteredPayoffDebtGroups();
    const filteredItemIds = new Set(filteredGroups.flatMap((g) => g.items.map((i) => i.id)));
    const selectedInFilter = new Set(
      Array.from(selectedPayoffTxIds).filter((id) => filteredItemIds.has(id))
    );
    if (executeBatchPayForIds(selectedInFilter, mode)) {
      selectedInFilter.forEach((id) => selectedPayoffTxIds.delete(id));
    }
  });

  // ==========================================
  // EVENTOS: ABA "FILTROS & CONTAS" (Filtro Receita/Despesa + Seleção Múltipla)
  // ==========================================
  ['tabFilterType', 'tabFilterMonth', 'tabFilterYear', 'tabFilterBank', 'tabFilterCategory', 'tabFilterModality', 'tabFilterStatus', 'tabFilterSearch'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', renderFilterTabView);
    el.addEventListener('input', renderFilterTabView);
  });

  document.getElementById('btnClearTabFilters').addEventListener('click', () => {
    document.getElementById('tabFilterType').value = 'all';
    document.getElementById('tabFilterMonth').value = 'all';
    document.getElementById('tabFilterYear').value = 'all';
    document.getElementById('tabFilterBank').value = 'all';
    document.getElementById('tabFilterCategory').value = 'all';
    multiSelectInstances['tabFilterBank']?.clear();
    multiSelectInstances['tabFilterCategory']?.clear();
    document.getElementById('tabFilterModality').value = 'all';
    document.getElementById('tabFilterStatus').value = 'all';
    document.getElementById('tabFilterSearch').value = '';
    renderFilterTabView();
  });

  document.getElementById('tabFilteredListContainer').addEventListener('change', (e) => {
    const chk = e.target.closest('[data-filtertab-chk-id]');
    if (!chk) return;
    const id = Number(chk.getAttribute('data-filtertab-chk-id'));
    if (chk.checked) {
      selectedFilterTabTxIds.add(id);
    } else {
      selectedFilterTabTxIds.delete(id);
    }
    renderFilterTabView();
  });

  document.getElementById('btnSelectAllFilterTabInst').addEventListener('click', () => {
    const filtered = getFilteredTabTransactionsList().filter((t) => t.type === 'expense' && !t.isPaid);
    filtered.forEach((t) => selectedFilterTabTxIds.add(t.id));
    renderFilterTabView();
  });

  document.getElementById('btnClearFilterTabInst').addEventListener('click', () => {
    selectedFilterTabTxIds.clear();
    renderFilterTabView();
  });

  document.getElementById('btnPayFilterTabSelected').addEventListener('click', () => {
    const mode = document.getElementById('filterTabBatchAdvanceMode').value;
    executeBatchPayForIds(selectedFilterTabTxIds, mode);
  });

  // Eventos do Agente de Lançamento Rápido e Guia na Esquerda
  const agentForm = document.getElementById('agentCommandForm');
  const agentInput = document.getElementById('agentCommandInput');

  agentInput.addEventListener('input', updateAgentLivePreview);

  agentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cmd = agentInput.value.trim();
    if (!cmd) return;
    parseAndExecuteAgentCommand(cmd);
    agentInput.value = '';
    document.getElementById('agentLivePreview').classList.add('hidden');
  });

  // Clicar num item do Guia de Comandos na barra lateral preenche o Agente
  document.querySelectorAll('.guide-item').forEach((item) => {
    item.addEventListener('click', () => {
      const template = item.getAttribute('data-template');
      agentInput.value = template;
      updateAgentLivePreview();
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
    saveUiPrefs();
    refreshDashboard();
  });

  yearSelect.addEventListener('change', (e) => {
    selectedYear = Number(e.target.value);
    document.getElementById('tabFilterYear').value = String(selectedYear);
    saveUiPrefs();
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
    saveUiPrefs();
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
    saveUiPrefs();
    refreshDashboard();
  });

  document.getElementById('cashflowChart').addEventListener('click', (e) => {
    const group = e.target.closest('[data-select-month]');
    if (!group) return;
    selectedMonth = group.getAttribute('data-select-month');
    monthSelect.value = selectedMonth;
    saveUiPrefs();
    refreshDashboard();
  });

  document.getElementById('searchInput').addEventListener('input', renderTransactionsList);
  document.getElementById('typeFilter').addEventListener('change', renderTransactionsList);
  document.getElementById('categoryFilter').addEventListener('change', renderTransactionsList);
  document.getElementById('bankFilter').addEventListener('change', renderTransactionsList);

  document.getElementById('installmentsSummaryList')?.addEventListener('click', handleCardActionClick);
  document.getElementById('transactionsListContainer').addEventListener('click', handleCardActionClick);
  document.getElementById('tabFilteredListContainer').addEventListener('click', handleCardActionClick);

  // Filtro "Ocultar parcelas já pagas" e Escopo de visualização de Parcelamentos
  document.getElementById('chkHidePaidInstallments')?.addEventListener('change', (e) => {
    uiPrefs.hidePaidInstallments = e.target.checked;
    saveUiPrefs();
    renderInstallmentsSummary();
  });
  document.getElementById('instViewScope')?.addEventListener('change', (e) => {
    uiPrefs.instViewScope = e.target.value;
    saveUiPrefs();
    renderInstallmentsSummary();
  });

  // Eventos do Modal de Detalhes / Adiantamento / Quitação de Parcelas
  const instModal = document.getElementById('installmentDetailModal');
  const closeInstModal = () => instModal.classList.add('hidden');

  document.getElementById('btnCloseInstModal').addEventListener('click', closeInstModal);
  document.getElementById('btnCloseInstModalBottom').addEventListener('click', closeInstModal);

  document.getElementById('instAllParcelsList').addEventListener('change', (e) => {
    if (e.target.classList.contains('inst-select-chk')) {
      updateInstallmentCalculator();
    }
  });

  document.getElementById('instAllParcelsList').addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-toggle-paid-id]');
    if (!toggleBtn) return;
    const id = Number(toggleBtn.getAttribute('data-toggle-paid-id'));
    const target = transactions.find((t) => t.id === id);
    if (!target) return;
    target.isPaid = !target.isPaid;
    saveTransactions();
    refreshDashboard();
    renderInstallmentDetailModalContent();
  });

  document.getElementById('btnSelectAllPending').addEventListener('click', () => {
    document.querySelectorAll('#instAllParcelsList .inst-select-chk').forEach((chk) => {
      const id = Number(chk.getAttribute('data-parcel-id'));
      const txItem = transactions.find((t) => t.id === id);
      chk.checked = txItem ? !txItem.isPaid : false;
    });
    updateInstallmentCalculator();
  });

  document.getElementById('btnClearSelection').addEventListener('click', () => {
    document.querySelectorAll('#instAllParcelsList .inst-select-chk').forEach((chk) => {
      chk.checked = false;
    });
    updateInstallmentCalculator();
  });

  document.getElementById('btnPaySelectedInstallments').addEventListener('click', () => {
    const checkedBoxes = Array.from(document.querySelectorAll('#instAllParcelsList .inst-select-chk:checked'));
    if (checkedBoxes.length === 0) {
      alert('Selecione ao menos uma parcela na lista abaixo para pagar ou adiantar.');
      return;
    }

    const selectedIds = new Set(checkedBoxes.map((c) => Number(c.getAttribute('data-parcel-id'))));
    const advanceMode = document.getElementById('instAdvanceMode').value;
    executeBatchPayForIds(selectedIds, advanceMode);
    renderInstallmentDetailModalContent();
  });

  // Exportar e Importar Backup (transferir dados de um PC para outro)
  document.getElementById('btnExportData').addEventListener('click', () => {
    const backupPayload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      userName,
      customBanks,
      chartColors,
      uiPrefs,
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

        if (parsed.chartColors && typeof parsed.chartColors === 'object') {
          chartColors = { ...DEFAULT_CHART_COLORS, ...parsed.chartColors };
          saveChartColors();
          applyChartColors();
        }

        if (parsed.uiPrefs && typeof parsed.uiPrefs === 'object') {
          uiPrefs = { ...DEFAULT_UI_PREFS, ...parsed.uiPrefs };
          selectedMonth = uiPrefs.selectedMonth || selectedMonth;
          selectedYear = Number(uiPrefs.selectedYear) || selectedYear;
          document.documentElement.setAttribute('data-theme', uiPrefs.theme === 'light' ? 'light' : 'dark');
          saveUiPrefs();
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

        normalizeTransactions();
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

  document.getElementById('btnResetAll').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja zerar todas as transações e deixar todos os saldos em R$ 0,00?')) {
      transactions = [];
      selectedPayoffTxIds.clear();
      selectedPeriodTxIds.clear();
      selectedFilterTabTxIds.clear();
      saveTransactions();
      refreshDashboard();
    }
  });

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

  document.getElementById('txEditScope').addEventListener('change', (e) => {
    const isAll = e.target.value === 'all';
    const editingId = document.getElementById('editingTxId').value;
    if (!editingId) return;
    const targetTx = transactions.find((t) => t.id === Number(editingId));
    if (!targetTx || !targetTx.groupId) return;

    const installmentFieldsEl = document.getElementById('installmentFields');
    if (isAll) {
      installmentFieldsEl.classList.remove('hidden');
      const groupItems = transactions
        .filter((t) => t.groupId === targetTx.groupId)
        .sort((a, b) => a.installmentNumber - b.installmentNumber);
      const firstItem = groupItems[0] || targetTx;
      document.getElementById('txStartMonth').value = firstItem.month;
      document.getElementById('txStartYear').value = firstItem.year;
      updateInstallmentPreview();
    } else {
      installmentFieldsEl.classList.add('hidden');
      document.getElementById('txStartMonth').value = targetTx.month;
      document.getElementById('txStartYear').value = targetTx.year;
    }
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
        // Se era à vista e o usuário optou por converter em Parcelado:
        if (!targetTx.isInstallment && isInstallmentMode) {
          const count = Math.max(2, parseInt(document.getElementById('txInstallments').value, 10) || 2);
          const valueMode = document.getElementById('txValueMode').value;
          const parcelAmount =
            valueMode === 'total'
              ? Math.round((rawAmount / count) * 100) / 100
              : Math.round(rawAmount * 100) / 100;

          const groupId = `grp_${Date.now()}`;
          const wasPaid = Boolean(targetTx.isPaid);
          const paidAt = targetTx.paidAt || null;

          // Remove o lançamento original à vista
          transactions = transactions.filter((t) => t.id !== idNum);

          // Cria a sequência de parcelas
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
              totalInstallments: count,
              isPaid: i === 0 && wasPaid,
              paidAt: i === 0 && wasPaid ? paidAt : null
            });
          }
        } else if (targetTx.isInstallment && targetTx.groupId) {
          const editScope = document.getElementById('txEditScope').value;
          if (editScope === 'all') {
            const count = Math.max(
              2,
              parseInt(document.getElementById('txInstallments').value, 10) || targetTx.totalInstallments || 2
            );
            const valueMode = document.getElementById('txValueMode').value;
            const parcelAmount =
              valueMode === 'total'
                ? Math.round((rawAmount / count) * 100) / 100
                : Math.round(rawAmount * 100) / 100;

            const groupItems = transactions
              .filter((t) => t.groupId === targetTx.groupId)
              .sort((a, b) => a.installmentNumber - b.installmentNumber);
            const currentCount = groupItems.length;

            if (count === currentCount) {
              groupItems.forEach((t, idx) => {
                const period = addMonthsToPeriod(startYear, startMonth, idx);
                t.baseDescription = baseDescription;
                t.description = `${baseDescription} (${idx + 1}/${count})`;
                t.amount = parcelAmount;
                t.type = type;
                t.category = category;
                t.account = account;
                t.totalInstallments = count;
                t.installmentNumber = idx + 1;
                t.year = period.year;
                t.month = period.month;
                t.periodKey = period.periodKey;
              });
            } else if (count < currentCount) {
              const toKeep = groupItems.slice(0, count);
              const toRemoveIds = new Set(groupItems.slice(count).map((t) => t.id));
              transactions = transactions.filter((t) => !toRemoveIds.has(t.id));

              toKeep.forEach((t, idx) => {
                const period = addMonthsToPeriod(startYear, startMonth, idx);
                t.baseDescription = baseDescription;
                t.description = `${baseDescription} (${idx + 1}/${count})`;
                t.amount = parcelAmount;
                t.type = type;
                t.category = category;
                t.account = account;
                t.totalInstallments = count;
                t.installmentNumber = idx + 1;
                t.year = period.year;
                t.month = period.month;
                t.periodKey = period.periodKey;
              });
            } else {
              groupItems.forEach((t, idx) => {
                const period = addMonthsToPeriod(startYear, startMonth, idx);
                t.baseDescription = baseDescription;
                t.description = `${baseDescription} (${idx + 1}/${count})`;
                t.amount = parcelAmount;
                t.type = type;
                t.category = category;
                t.account = account;
                t.totalInstallments = count;
                t.installmentNumber = idx + 1;
                t.year = period.year;
                t.month = period.month;
                t.periodKey = period.periodKey;
              });

              const highestId = transactions.reduce((max, t) => Math.max(max, t.id || 0), Date.now());
              for (let i = currentCount; i < count; i++) {
                const period = addMonthsToPeriod(startYear, startMonth, i);
                transactions.push({
                  id: highestId + (i - currentCount + 1),
                  groupId: targetTx.groupId,
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
                  totalInstallments: count,
                  isPaid: false,
                  paidAt: null
                });
              }
            }
          } else {
            // Edição de apenas uma parcela específica
            const period = addMonthsToPeriod(startYear, startMonth, 0);
            targetTx.baseDescription = baseDescription;
            targetTx.description = `${baseDescription} (${targetTx.installmentNumber}/${targetTx.totalInstallments})`;
            targetTx.amount = Math.round(rawAmount * 100) / 100;
            targetTx.type = type;
            targetTx.category = category;
            targetTx.account = account;
            targetTx.year = period.year;
            targetTx.month = period.month;
            targetTx.periodKey = period.periodKey;
          }
        } else {
          // Edição normal à vista
          const period = addMonthsToPeriod(startYear, startMonth, 0);
          targetTx.baseDescription = baseDescription;
          targetTx.description = baseDescription;
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

    saveUiPrefs();
    saveTransactions();
    refreshDashboard();
    closeModal();
  });

  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const nextTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', nextTheme);
    uiPrefs.theme = nextTheme;
    saveUiPrefs();
  });
});
