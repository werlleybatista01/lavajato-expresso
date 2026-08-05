/**
 * Interactive Business Simulators Module
 */

const SimuladoresModule = {
    activeSubTab: 'preco',

    async init() {
        this.bindEvents();
        await this.renderCurrentSubTab();
    },

    bindEvents() {
        const subTabBtns = document.querySelectorAll('.sim-tab-btn');
        subTabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                subTabBtns.forEach(b => {
                    b.classList.remove('bg-amber-500', 'text-zinc-950', 'shadow-sm');
                    b.classList.add('text-zinc-400', 'hover:bg-zinc-800');
                });
                const target = e.currentTarget;
                target.classList.remove('text-zinc-400', 'hover:bg-zinc-800');
                target.classList.add('bg-amber-500', 'text-zinc-950', 'shadow-sm');

                this.activeSubTab = target.dataset.sim;
                this.switchSubTab(this.activeSubTab);
            });
        });
    },

    switchSubTab(simName) {
        document.querySelectorAll('.sim-content-box').forEach(el => el.classList.add('hidden'));
        const activeBox = document.getElementById(`sim-box-${simName}`);
        if (activeBox) activeBox.classList.remove('hidden');

        this.renderCurrentSubTab();
    },

    async renderCurrentSubTab() {
        if (this.activeSubTab === 'preco') this.calcularSimuladorPreco();
        if (this.activeSubTab === 'financeiro') this.calcularSimuladorFinanceiro();
        if (this.activeSubTab === 'expansao') this.calcularSimuladorExpansao();
        if (this.activeSubTab === 'consumo') this.calcularSimuladorConsumo();
        if (this.activeSubTab === 'metas') this.calcularSimuladorMetas();
    },

    // 1. SIMULADOR DE PREÇO DE SERVIÇO
    calcularSimuladorPreco() {
        const custoMat = parseFloat(document.getElementById('sim-preco-mat')?.value) || 0;
        const tempoMin = parseFloat(document.getElementById('sim-preco-tempo')?.value) || 0;
        const custoHoraFunc = parseFloat(document.getElementById('sim-preco-func-hora')?.value) || 0;
        const custoLuzAguaMin = parseFloat(document.getElementById('sim-preco-util-min')?.value) || 0;
        const aluguelProp = parseFloat(document.getElementById('sim-preco-aluguel')?.value) || 0;
        const taxaImpostoPct = parseFloat(document.getElementById('sim-preco-imposto')?.value) || 0;
        const margemDesejadaPct = parseFloat(document.getElementById('sim-preco-margem')?.value) || 0;

        const result = BusinessRules.calculateServicePrice({
            material: custoMat, minutes: tempoMin, laborHour: custoHoraFunc,
            utilitiesMinute: custoLuzAguaMin, allocatedFixedCost: aluguelProp,
            taxPercent: taxaImpostoPct, targetMarginPercent: margemDesejadaPct
        });
        if (!result.valid) {
            Utils.showToast('Impostos e margem devem somar menos de 100%, sem valores negativos.', 'error');
            return;
        }

        // UI Update
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setText('sim-res-custo-total', Utils.formatCurrency(result.directCost));
        setText('sim-res-preco-min', Utils.formatCurrency(result.minimumPrice));
        setText('sim-res-preco-rec', Utils.formatCurrency(result.recommendedPrice));
        setText('sim-res-lucro-estimado', Utils.formatCurrency(result.profit));
        setText('sim-res-margem-efetiva', Utils.formatPercent(result.effectiveMargin));
    },

    // 2. SIMULADOR FINANCEIRO
    async calcularSimuladorFinanceiro() {
        const precoMedio = parseFloat(document.getElementById('sim-fin-preco-medio')?.value) || 0;
        const clientesDia = parseFloat(document.getElementById('sim-fin-clientes-dia')?.value) || 0;
        const diasTrabalhados = parseFloat(document.getElementById('sim-fin-dias-mes')?.value) || 0;
        const custosFixos = parseFloat(document.getElementById('sim-fin-custos-fixos')?.value) || 0;
        const custoVarPorCarro = parseFloat(document.getElementById('sim-fin-custo-var-carro')?.value) || 0;

        const totalAtendimentos = clientesDia * diasTrabalhados;
        const receitaBrutaProjetada = totalAtendimentos * precoMedio;
        const custosVariaveisTotais = totalAtendimentos * custoVarPorCarro;

        const lucroBruto = receitaBrutaProjetada - custosVariaveisTotais;
        const lucroLiquido = lucroBruto - custosFixos;
        const margemLiquida = receitaBrutaProjetada > 0 ? (lucroLiquido / receitaBrutaProjetada) * 100 : 0;

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setText('sim-fin-res-atendimentos', `${totalAtendimentos} veículos`);
        setText('sim-fin-res-receita', Utils.formatCurrency(receitaBrutaProjetada));
        setText('sim-fin-res-lucro-bruto', Utils.formatCurrency(lucroBruto));
        setText('sim-fin-res-lucro-liquido', Utils.formatCurrency(lucroLiquido));
        setText('sim-fin-res-margem', Utils.formatPercent(margemLiquida));
    },

    // 3. SIMULADOR DE EXPANSÃO (PAYBACK)
    calcularSimuladorExpansao() {
        const investimento = parseFloat(document.getElementById('sim-exp-investimento')?.value) || 0;
        const receitaAdicionalMes = parseFloat(document.getElementById('sim-exp-receita-add')?.value) || 0;
        const custoAdicionalMes = parseFloat(document.getElementById('sim-exp-custo-add')?.value) || 0;

        const lucroAdicionalMes = receitaAdicionalMes - custoAdicionalMes;
        const mesesPayback = lucroAdicionalMes > 0 ? (investimento / lucroAdicionalMes) : 0;
        const roiPrimeiroAno = investimento > 0 ? ((lucroAdicionalMes * 12) / investimento) * 100 : 0;

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setText('sim-exp-res-investimento', Utils.formatCurrency(investimento));
        setText('sim-exp-res-lucro-add', Utils.formatCurrency(lucroAdicionalMes));
        setText('sim-exp-res-payback', mesesPayback > 0 ? `${mesesPayback.toFixed(1)} meses` : 'Sem Retorno');
        setText('sim-exp-res-roi-12m', Utils.formatPercent(roiPrimeiroAno));
    },

    // 4. SIMULADOR DE CONSUMO (ÁGUA E ENERGIA)
    async calcularSimuladorConsumo() {
        const config = (await dbService.getById('configuracoes', 'main')) || {};
        const tarifaAguaM3 = config.valorAguaM3 || 8.50;
        const tarifaKwh = config.valorKwh || 0.85;

        // Água
        const litrosPorVeiculo = parseFloat(document.getElementById('sim-con-litros-veiculo')?.value) || 0;
        const veiculosMes = parseFloat(document.getElementById('sim-con-veiculos-mes')?.value) || 0;

        const consumoLitrosMes = litrosPorVeiculo * veiculosMes;
        const consumoM3Mes = consumoLitrosMes / 1000;
        const custoAguaMes = consumoM3Mes * tarifaAguaM3;

        // Energia (Equipamentos)
        const potAspirador = parseFloat(document.getElementById('sim-con-pot-aspirador')?.value) || 0; // kW
        const horAspirador = parseFloat(document.getElementById('sim-con-hor-aspirador')?.value) || 0; // hrs/dia

        const potLavadora = parseFloat(document.getElementById('sim-con-pot-lavadora')?.value) || 0;
        const horLavadora = parseFloat(document.getElementById('sim-con-hor-lavadora')?.value) || 0;

        const potCompressor = parseFloat(document.getElementById('sim-con-pot-compressor')?.value) || 0;
        const horCompressor = parseFloat(document.getElementById('sim-con-hor-compressor')?.value) || 0;

        const diasTrabalhados = 26; // Dias úteis padrão
        const kwhDia = (potAspirador * horAspirador) + (potLavadora * horLavadora) + (potCompressor * horCompressor);
        const kwhMes = kwhDia * diasTrabalhados;
        const custoEnergiaMes = kwhMes * tarifaKwh;

        const custoTotalInsumos = custoAguaMes + custoEnergiaMes;

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setText('sim-con-res-m3-agua', `${consumoM3Mes.toFixed(1)} m³`);
        setText('sim-con-res-custo-agua', Utils.formatCurrency(custoAguaMes));
        setText('sim-con-res-kwh-luz', `${kwhMes.toFixed(1)} kWh`);
        setText('sim-con-res-custo-luz', Utils.formatCurrency(custoEnergiaMes));
        setText('sim-con-res-custo-total-util', Utils.formatCurrency(custoTotalInsumos));
    },

    // 5. SIMULADOR DE METAS
    async calcularSimuladorMetas() {
        const receitas = await dbService.getAll('receitas');
        const config = (await dbService.getById('configuracoes', 'main')) || {};

        const kpis = Utils.calculateKPIs(receitas, []);
        const metaInput = parseFloat(document.getElementById('sim-met-target')?.value) || config.metaMensal || 35000;
        const diasRestantesInput = parseInt(document.getElementById('sim-met-dias-restantes')?.value) || 15;

        const receitaAtualMes = kpis.recMes;
        const valorFaltante = Math.max(0, metaInput - receitaAtualMes);
        const ticketMedio = kpis.ticketMedio > 0 ? kpis.ticketMedio : 75;

        const receitaDiariaNecessaria = diasRestantesInput > 0 ? valorFaltante / diasRestantesInput : 0;
        const clientesDiaNecessarios = ticketMedio > 0 ? Math.ceil(receitaDiariaNecessaria / ticketMedio) : 0;
        const totalClientesFaltantes = ticketMedio > 0 ? Math.ceil(valorFaltante / ticketMedio) : 0;

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setText('sim-met-res-atual', Utils.formatCurrency(receitaAtualMes));
        setText('sim-met-res-faltante', Utils.formatCurrency(valorFaltante));
        setText('sim-met-res-rec-diaria', Utils.formatCurrency(receitaDiariaNecessaria));
        setText('sim-met-res-clientes-dia', `${clientesDiaNecessarios} clientes/dia`);
        setText('sim-met-res-total-clientes', `${totalClientesFaltantes} veículos`);
    }
};


window.SimuladoresModule = SimuladoresModule;
