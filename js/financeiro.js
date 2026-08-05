/**
 * Financeiro Module (Receitas, Despesas Fixas/Variáveis, Fluxo de Caixa, DRE)
 */

const FinanceiroModule = {
    activeTab: 'receitas',

    async init() {
        this.bindEvents();
        await this.render();
    },

    bindEvents() {
        // Tab switching inside Financeiro
        const tabBtns = document.querySelectorAll('.fin-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabBtns.forEach(b => {
                    b.classList.remove('bg-amber-500', 'text-zinc-950', 'shadow-sm');
                    b.classList.add('text-zinc-400', 'hover:bg-zinc-800');
                });
                const target = e.currentTarget;
                target.classList.remove('text-zinc-400', 'hover:bg-zinc-800');
                target.classList.add('bg-amber-500', 'text-zinc-950', 'shadow-sm');

                this.activeTab = target.dataset.tab;
                this.switchTab(this.activeTab);
            });
        });

        // Search and Filters
        const inputBuscaRec = document.getElementById('search-receita');
        if (inputBuscaRec) {
            inputBuscaRec.addEventListener('input', () => this.renderReceitas());
        }

        const inputBuscaDesp = document.getElementById('search-despesa');
        if (inputBuscaDesp) {
            inputBuscaDesp.addEventListener('input', () => this.renderDespesas());
        }
    },

    switchTab(tabName) {
        document.querySelectorAll('.fin-tab-content').forEach(el => el.classList.add('hidden'));
        const activeContent = document.getElementById(`fin-content-${tabName}`);
        if (activeContent) activeContent.classList.remove('hidden');

        if (tabName === 'receitas') this.renderReceitas();
        if (tabName === 'despesas') this.renderDespesas();
        if (tabName === 'fluxo') this.renderFluxoCaixa();
        if (tabName === 'dre') this.renderDRE();
    },

    async render() {
        await this.renderReceitas();
        await this.renderDespesas();
        await this.renderFluxoCaixa();
        await this.renderDRE();
        this.switchTab(this.activeTab);
    },

    // --- RECEITAS ---
    async renderReceitas() {
        const receitas = await dbService.getAll('receitas');
        const tbody = document.getElementById('tbody-receitas');
        if (!tbody) return;

        const query = (document.getElementById('search-receita')?.value || '').toLowerCase();
        const filtradas = receitas.filter(r => 
            (r.cliente && r.cliente.toLowerCase().includes(query)) ||
            (r.servico && r.servico.toLowerCase().includes(query)) ||
            (r.formaPagamento && r.formaPagamento.toLowerCase().includes(query))
        ).sort((a, b) => new Date(b.data) - new Date(a.data));

        let totalSoma = 0;

        if (filtradas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 text-sm">Nenhuma receita encontrada.</td></tr>`;
        } else {
            tbody.innerHTML = filtradas.map(r => {
                const val = parseFloat(r.valor) || 0;
                totalSoma += val;
                return `
                    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td class="py-3.5 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">${Utils.formatDate(r.data)}</td>
                        <td class="py-3.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100">${r.cliente || 'Cliente Avulso'}</td>
                        <td class="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">${r.servico || '-'}</td>
                        <td class="py-3.5 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">${r.funcionario || '-'}</td>
                        <td class="py-3.5 px-4 text-xs">
                            <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                ${r.formaPagamento || 'Pix'}
                            </span>
                        </td>
                        <td class="py-3.5 px-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 text-right">${Utils.formatCurrency(val)}</td>
                        <td class="py-3.5 px-4 text-xs text-right">
                            <button onclick="FinanceiroModule.deleteReceita(${r.id})" class="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1.5 transition">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const elTotal = document.getElementById('total-receitas-list');
        if (elTotal) elTotal.innerText = Utils.formatCurrency(totalSoma);
    },

    async openNovaReceitaModal() {
        const servicos = await dbService.getAll('servicos');
        const funcionarios = await dbService.getAll('funcionarios');
        const clientes = await dbService.getAll('clientes');

        const selectServico = document.getElementById('rec-servico');
        const selectFunc = document.getElementById('rec-funcionario');
        const selectCliente = document.getElementById('rec-cliente');

        if (selectServico) {
            selectServico.innerHTML = '<option value="">Selecione um serviço...</option>' + 
                servicos.map(s => `<option value="${s.nome}" data-valor="${s.valorCobrado}">${s.nome} (${Utils.formatCurrency(s.valorCobrado)})</option>`).join('');
            
            selectServico.onchange = (e) => {
                const opt = e.target.selectedOptions[0];
                if (opt && opt.dataset.valor) {
                    document.getElementById('rec-valor').value = opt.dataset.valor;
                }
            };
        }

        if (selectFunc) {
            selectFunc.innerHTML = '<option value="">Selecione o responsável...</option>' + 
                funcionarios.map(f => `<option value="${f.nome}">${f.nome} - ${f.cargo}</option>`).join('');
        }

        if (selectCliente) {
            selectCliente.innerHTML = '<option value="">Digite ou Selecione um cliente...</option>' + 
                clientes.map(c => `<option value="${c.nome}">${c.nome} (${c.veiculo || 'S/ Veículo'})</option>`).join('');
        }

        document.getElementById('rec-data').value = Utils.getTodayISO();
        document.getElementById('rec-valor').value = '';
        document.getElementById('rec-obs').value = '';

        document.getElementById('modal-receita').classList.remove('hidden');
    },

    async saveReceita(e) {
        e.preventDefault();
        const data = document.getElementById('rec-data').value;
        const clienteInput = document.getElementById('rec-cliente-custom').value || document.getElementById('rec-cliente').value || 'Cliente Avulso';
        const servico = document.getElementById('rec-servico').value;
        const funcionario = document.getElementById('rec-funcionario').value;
        const formaPagamento = document.getElementById('rec-forma').value;
        const valor = parseFloat(document.getElementById('rec-valor').value) || 0;
        const observacoes = document.getElementById('rec-obs').value;

        if (!data || !valor || valor <= 0) {
            Utils.showToast('Preencha a data e o valor da receita!', 'error');
            return;
        }

        await dbService.add('receitas', {
            data,
            cliente: clienteInput,
            servico,
            funcionario,
            formaPagamento,
            valor,
            observacoes
        });

        Utils.showToast('Receita lançada com sucesso!', 'success');
        document.getElementById('modal-receita').classList.add('hidden');

        await App.refreshAllData();
    },

    async deleteReceita(id) {
        if (confirm('Tem certeza que deseja excluir esta receita?')) {
            await dbService.delete('receitas', id);
            Utils.showToast('Receita removida.', 'info');
            await App.refreshAllData();
        }
    },

    // --- DESPESAS ---
    async renderDespesas() {
        const despesas = await dbService.getAll('despesas');
        const tbody = document.getElementById('tbody-despesas');
        if (!tbody) return;

        const query = (document.getElementById('search-despesa')?.value || '').toLowerCase();
        const filtradas = despesas.filter(d => 
            (d.item && d.item.toLowerCase().includes(query)) ||
            (d.categoria && d.categoria.toLowerCase().includes(query))
        ).sort((a, b) => new Date(b.data) - new Date(a.data));

        let totalFixas = 0;
        let totalVariaveis = 0;

        if (filtradas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 text-sm">Nenhuma despesa encontrada.</td></tr>`;
        } else {
            tbody.innerHTML = filtradas.map(d => {
                const val = parseFloat(d.valor) || 0;
                if (d.tipo === 'fixa') totalFixas += val;
                else totalVariaveis += val;

                const badgeClass = d.tipo === 'fixa' 
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';

                return `
                    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td class="py-3.5 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">${Utils.formatDate(d.data)}</td>
                        <td class="py-3.5 px-4 text-xs">
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${badgeClass}">
                                ${d.tipo === 'fixa' ? 'Fixa' : 'Variável'}
                            </span>
                        </td>
                        <td class="py-3.5 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">${d.categoria || '-'}</td>
                        <td class="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">${d.item || '-'}</td>
                        <td class="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">${d.observacoes || '-'}</td>
                        <td class="py-3.5 px-4 text-xs font-bold text-rose-600 dark:text-rose-400 text-right">${Utils.formatCurrency(val)}</td>
                        <td class="py-3.5 px-4 text-xs text-right">
                            <button onclick="FinanceiroModule.deleteDespesa(${d.id})" class="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1.5 transition">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const elFixa = document.getElementById('total-despesas-fixas-list');
        const elVar = document.getElementById('total-despesas-var-list');
        const elTotal = document.getElementById('total-despesas-geral-list');

        if (elFixa) elFixa.innerText = Utils.formatCurrency(totalFixas);
        if (elVar) elVar.innerText = Utils.formatCurrency(totalVariaveis);
        if (elTotal) elTotal.innerText = Utils.formatCurrency(totalFixas + totalVariaveis);
    },

    openNovaDespesaModal() {
        document.getElementById('desp-data').value = Utils.getTodayISO();
        document.getElementById('desp-item').value = '';
        document.getElementById('desp-valor').value = '';
        document.getElementById('desp-obs').value = '';

        document.getElementById('modal-despesa').classList.remove('hidden');
    },

    async saveDespesa(e) {
        e.preventDefault();
        const data = document.getElementById('desp-data').value;
        const tipo = document.getElementById('desp-tipo').value;
        const categoria = document.getElementById('desp-categoria').value;
        const item = document.getElementById('desp-item').value;
        const valor = parseFloat(document.getElementById('desp-valor').value) || 0;
        const observacoes = document.getElementById('desp-obs').value;

        if (!data || !item || !valor || valor <= 0) {
            Utils.showToast('Preencha os campos obrigatórios da despesa!', 'error');
            return;
        }

        await dbService.add('despesas', {
            data,
            tipo,
            categoria,
            item,
            valor,
            observacoes
        });

        Utils.showToast('Despesa cadastrada!', 'success');
        document.getElementById('modal-despesa').classList.add('hidden');

        await App.refreshAllData();
    },

    async deleteDespesa(id) {
        if (confirm('Deseja realmente remover esta despesa?')) {
            await dbService.delete('despesas', id);
            Utils.showToast('Despesa excluída.', 'info');
            await App.refreshAllData();
        }
    },

    // --- FLUXO DE CAIXA ---
    async renderFluxoCaixa() {
        const receitas = await dbService.getAll('receitas');
        const despesas = await dbService.getAll('despesas');

        const kpis = Utils.calculateKPIs(receitas, despesas);

        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = Utils.formatCurrency(val);
        };

        setText('fc-entradas', kpis.totalReceita);
        setText('fc-saidas', kpis.totalDespesas);

        const elSaldo = document.getElementById('fc-saldo-total');
        if (elSaldo) {
            elSaldo.innerText = Utils.formatCurrency(kpis.lucroLiquido);
            elSaldo.className = `text-2xl font-bold ${kpis.lucroLiquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;
        }

        chartManager.renderFluxoCaixaChart('chart-fluxo-caixa-full', receitas, despesas);
    },

    // --- DRE (Demonstração do Resultado do Exercício) ---
    async renderDRE() {
        const receitas = await dbService.getAll('receitas');
        const despesas = await dbService.getAll('despesas');

        const kpis = Utils.calculateKPIs(receitas, despesas);

        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = Utils.formatCurrency(val);
        };

        const setPercent = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = Utils.formatPercent(val);
        };

        setText('dre-receita-bruta', kpis.totalReceita);
        setText('dre-despesas-variaveis', kpis.despesasVariaveis);
        setText('dre-lucro-bruto', kpis.lucroBruto);
        setPercent('dre-margem-bruta', kpis.margemBruta);

        setText('dre-despesas-fixas', kpis.despesasFixas);
        setText('dre-lucro-liquido', kpis.lucroLiquido);
        setPercent('dre-margem-liquida', kpis.margemLiquida);
    }
};


window.FinanceiroModule = FinanceiroModule;
