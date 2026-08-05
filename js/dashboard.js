/**
 * Dashboard Controller
 */

const DashboardModule = {
    async init() {
        await this.render();
    },

    async render() {
        const receitas = await dbService.getAll('receitas');
        const despesas = await dbService.getAll('despesas');
        const estoque = await dbService.getAll('estoque');
        const funcionarios = await dbService.getAll('funcionarios');
        const servicos = await dbService.getAll('servicos');
        const config = (await dbService.getById('configuracoes', 'main')) || {};
        const registrosReceita = receitas.filter(BusinessRules.isActive);
        const registrosDespesa = despesas.filter(BusinessRules.isActive);
        const { monthStart, monthEnd } = BusinessRules.getRanges();
        const despesasMes = registrosDespesa.filter((item) => {
            const date = BusinessRules.parseISODate(item.data);
            return date && date >= monthStart && date < monthEnd;
        });

        const kpis = Utils.calculateKPIs(receitas, despesas, estoque, funcionarios, servicos);
        const metaMensal = config.metaMensal || 35000;

        // Render KPI Cards
        this.updateKPICards(kpis, metaMensal);

        // Render Dashboard Charts
        chartManager.renderReceitaDiariaChart('chart-receita-diaria', registrosReceita);
        chartManager.renderReceitaMensalChart('chart-receita-mensal', registrosReceita, metaMensal);
        chartManager.renderDespesasPieChart('chart-despesas-categoria', despesasMes);
        chartManager.renderFluxoCaixaChart('chart-fluxo-caixa-dash', registrosReceita, registrosDespesa);
        chartManager.renderServicosPopularesChart('chart-servicos-populares', registrosReceita);
        chartManager.renderFuncionariosChart('chart-funcionarios-dash', registrosReceita);

        // Render Recent Activity Table
        this.renderTabelaRecentes(registrosReceita);

        // Render Alerts (Estoque baixo e Contas)
        this.renderAlertas(estoque, despesas);
    },

    updateKPICards(kpis, metaMensal) {
        // Elements updates
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setText('kpi-rec-dia', Utils.formatCurrency(kpis.recDia));
        setText('kpi-rec-semana', Utils.formatCurrency(kpis.recSemana));
        setText('kpi-rec-mes', Utils.formatCurrency(kpis.recMes));
        setText('kpi-rec-ano', Utils.formatCurrency(kpis.recAno));
        setText('kpi-lucro-liquido', Utils.formatCurrency(kpis.lucroLiquido));
        setText('kpi-lucro-bruto', Utils.formatCurrency(kpis.lucroBruto));
        setText('kpi-ticket-medio', Utils.formatCurrency(kpis.ticketMedio));
        setText('kpi-qtd-clientes', kpis.qtdClientes);
        setText('kpi-qtd-veiculos', kpis.qtdVeiculos);
        setText('kpi-margem-lucro', Utils.formatPercent(kpis.margemLiquida));
        setText('kpi-ponto-equilibrio', kpis.pontoEquilibrio == null ? 'Não calculável' : Utils.formatCurrency(kpis.pontoEquilibrio));
        setText('kpi-valor-estoque', Utils.formatCurrency(kpis.valorEstoque));
        setText('kpi-func-ativos', kpis.funcAtivos);
        setText('kpi-rec-func', Utils.formatCurrency(kpis.recPorFuncionario));
        setText('kpi-despesas-fixas', Utils.formatCurrency(kpis.despesasFixas));
        setText('kpi-despesas-variaveis', Utils.formatCurrency(kpis.despesasVariaveis));

        // Meta Mensal Progress
        const percentMeta = metaMensal > 0 ? Math.min(100, Math.max(0, Math.round((kpis.recMes / metaMensal) * 100))) : 0;
        setText('kpi-meta-val', `${Utils.formatCurrency(kpis.recMes)} / ${Utils.formatCurrency(metaMensal)}`);
        setText('kpi-meta-percent', `${percentMeta}% Atingido`);

        const progressBar = document.getElementById('kpi-meta-bar');
        if (progressBar) {
            progressBar.style.width = `${percentMeta}%`;
            progressBar.className = `h-2.5 rounded-full transition-all duration-500 ${percentMeta >= 100 ? 'bg-emerald-500' : percentMeta >= 50 ? 'bg-blue-600' : 'bg-amber-500'}`;
        }
    },

    renderTabelaRecentes(receitas) {
        const tbody = document.getElementById('tbody-recentes');
        if (!tbody) return;

        // Sort descending by date
        const ultimas = [...receitas].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 6);

        if (ultimas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400">Nenhum atendimento registrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = ultimas.map(r => `
            <tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <td class="py-3 px-4 text-xs font-medium text-slate-700 dark:text-slate-300">${Utils.formatDate(r.data)}</td>
                <td class="py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">${Utils.escapeHTML(r.cliente || 'Cliente Avulso')}</td>
                <td class="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">${Utils.escapeHTML(r.servicoNome || r.servico || '-')}</td>
                <td class="py-3 px-4 text-xs">
                    <span class="px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        ${Utils.escapeHTML(r.formaPagamento || 'Pix')}
                    </span>
                </td>
                <td class="py-3 px-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 text-right">${Utils.formatCurrency(r.valor)}</td>
            </tr>
        `).join('');
    },

    renderAlertas(estoque, despesas) {
        const container = document.getElementById('dashboard-alertas');
        if (!container) return;

        const alertas = [];

        // Estoque baixo
        estoque.filter(BusinessRules.isActive).forEach(item => {
            const qtd = parseFloat(item.quantidade) || 0;
            const min = parseFloat(item.quantidadeMinima) || 0;
            if (qtd <= min) {
                alertas.push({
                    tipo: 'warning',
                    titulo: 'Estoque Baixo',
                    mensagem: `O produto <b>${Utils.escapeHTML(item.nome)}</b> está com apenas ${qtd} ${Utils.escapeHTML(item.unidade)}(s) em estoque (Mínimo: ${min}).`
                });
            }
        });

        if (alertas.length === 0) {
            container.innerHTML = `
                <div class="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800/50">
                    <i class="fa-solid fa-circle-check text-base"></i>
                    <span>Tudo em dia! Sem alertas operacionais pendentes no momento.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = alertas.map(a => `
            <div class="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-medium border border-amber-200 dark:border-amber-800/50">
                <i class="fa-solid fa-triangle-exclamation text-base mt-0.5 text-amber-600 dark:text-amber-400"></i>
                <div>
                    <strong class="block text-amber-900 dark:text-amber-200 font-semibold mb-0.5">${a.titulo}</strong>
                    <span>${a.mensagem}</span>
                </div>
            </div>
        `).join('');
    }
};


window.DashboardModule = DashboardModule;
