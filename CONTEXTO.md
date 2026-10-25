# Contexto do Projeto e Histórico de Desenvolvimento — Minhas Finanças

> **Instrução para IA em outro computador:** Ao iniciar uma nova conversa neste repositório, leia este arquivo e os arquivos `index.html`, `styles.css` e `app.js` para continuar o desenvolvimento mantendo todas as preferências do usuário.

---

## 1. Visão Geral do Projeto
Aplicação pessoal de controle financeiro (**Minhas Finanças**) criada em **HTML5, CSS3 e JavaScript puro (ES6)** para rodar tanto no navegador quanto como aplicativo Desktop no Windows (`MinhasFinancas.exe` e instalador de arquivo único `Instalador-MinhasFinancas.exe`).

- **Repositório GitHub:** `https://github.com/JEGABR/minhas-financas`
- **Armazenamento de dados:** `localStorage` do navegador/WebView, com suporte completo a **Exportar e Importar Backup (`.json`)** para transferir dados entre PCs.

---

## 2. Funcionalidades Implementadas (Histórico da Conversa)

1. **Interface e Layout Personalizados:**
   - Modo Escuro (padrão, com `color-scheme: dark` corrigido nos `<select>`) e Modo Claro alternáveis pelo botão no topo.
   - Nome do usuário editável na barra lateral esquerda (`#btnEditUserName`), atualizando também o avatar e o título de boas-vindas (`localStorage` key: `minhas_financas_username`).
   - Status inicial 100% zerado (`R$ 0,00`), sem dados fictícios, com botão **"Zerar todos os dados"** na barra lateral.

2. **Navegação por Abas na Barra Lateral:**
   - **Aba 1 — Visão Geral (`#viewVisaoGeral`):**
     - Exibe 3 cartões principais no topo: **Receitas no Período**, **Despesas no Período** e **Balanço do Período** (que também atualizam em tempo real caso algum filtro seja aplicado na seção de transações abaixo).
     - **Gráfico de Fluxo de Caixa Anual (Jan a Dez):** com seletores de cor personalizáveis para **Receitas** e **Despesas** (`#colorPickerIncome`, `#colorPickerExpense`) e botão **Padrão** (`localStorage` key: `minhas_financas_chart_colors`).
     - **Gráfico de Gastos por Categoria:** barras de progresso proporcionais às despesas do período/filtro.
     - **Seção Parcelamentos no Período:** cartões visuais com barra de progresso e opção **"Ocultar parcelas já pagas"** (`#chkHidePaidInstallments`).
     - **Seção Transações e Contas do Período:** mesmo design visual de cartões com barra de progresso, filtros de busca, banco e categoria.
   - **Aba 2 — Filtros & Contas (`#viewFiltros`):**
     - Painel de filtros combinados: **Mês**, **Ano**, **Banco/Conta**, **Categoria**, **Modalidade** (Todas, Somente Parcelados, Somente À Vista) e **Busca por texto**.
     - Exibe o cartão **Saldo Acumulado Geral** (soma geral de todas as receitas menos despesas cadastradas) ao lado dos cartões **Receitas (Filtro Aplicado)**, **Despesas (Filtro Aplicado)** e **Balanço do Filtro**.

3. **Lançamentos À Vista, Parcelados e Virada Automática de Ano:**
   - Modal de Nova/Editar Transação (`#transactionModal`) com botão alternador **À vista (1x)** / **Parcelado**.
   - Quando **Parcelado** está ativo, permite informar a quantidade de parcelas (`2x` até `120x`) e escolher se o valor digitado é o **Valor Total (dividir pelas parcelas)** ou o **Valor de cada parcela**.
   - A função `addMonthsToPeriod(startYear, startMonth, offset)` distribui automaticamente as parcelas pelos meses seguintes, virando de Dezembro para Janeiro do próximo ano (e quantos anos forem necessários).
   - Suporte a 17 bancos brasileiros pré-cadastrados + opção **"+ Editar / Digitar outro banco ou conta..."** (`localStorage` key: `minhas_financas_custom_banks`).

4. **Central de Detalhes, Adiantamento e Quitação de Parcelas (`#installmentDetailModal`):**
   - Ao clicar em qualquer parcela (ou no botão **"📋 Parcelas / Adiantar"**), abre o modal detalhado mostrando:
     - **Valor Total da Compra**, **Já Pago / Adiantado** e **Valor para Quitar Tudo**.
     - Barra de progresso real de quitação e lista de todas as parcelas (`1/N` até `N/N`).
     - **Calculadora interativa de adiantamento:** ao selecionar uma ou várias parcelas (ou clicar em **"Selecionar todas pendentes (Quitar Tudo)"**), calcula na hora o valor total selecionado para pagar.
     - Três modos ao pagar/adiantar parcelas selecionadas:
       1. *Marcar como Paga (mantém no mês original)* — exibe selo verde `✅ Paga / Adiantada`.
       2. *Adiantar e puxar cobrança para o mês atual*.
       3. *Quitar e remover parcelas adiantadas da lista*.

5. **🤖 Agente de Lançamento Rápido + Guia de Comandos na Esquerda:**
   - Barra no topo (`#agentCommandForm`) que interpreta frases naturais em português offline (`analyzeAgentCommand` e `parseAndExecuteAgentCommand`), com **prévia ao vivo (`#agentLivePreview`)** enquanto o usuário digita e botão **"Desfazer lançamento"**.
   - Quadro **"🤖 Guia de Comandos"** na barra lateral esquerda com 5 modelos clicáveis (Parcelar Valor Total, Parcelar pelo Valor da Parcela, Gasto À Vista, Receita/Salário e Escolher Mês Inicial).

6. **Backup & Transferência entre PCs:**
   - Botões **📥 Exportar Backup** e **📤 Importar Backup** na barra lateral esquerda para salvar e carregar um arquivo `.json` com todas as transações, parcelas, bancos personalizados, cores do gráfico e nome do perfil.

---

## 3. Como Recompilar o Executável e o Instalador no Windows
O projeto utiliza o compilador nativo do Windows (`.NET Framework csc.exe`) sem depender de Node.js:

```powershell
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /win32icon:"app.ico" /out:"MinhasFinancas.exe" "Launcher.cs"
& $csc /nologo /target:winexe /win32icon:"app.ico" /resource:"index.html,index.html" /resource:"styles.css,styles.css" /resource:"app.js,app.js" /resource:"MinhasFinancas.exe,MinhasFinancas.exe" /resource:"app.ico,app.ico" /out:"Instalador-MinhasFinancas.exe" "Installer.cs"
```
