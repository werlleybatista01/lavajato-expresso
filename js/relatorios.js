/**
 * Relatórios e Exportação Module
 */

const RelatoriosModule = {
    async init() {
        this.bindEvents();
    },

    bindEvents() {
        const btnPdf = document.getElementById('btn-export-pdf');
        if (btnPdf) btnPdf.addEventListener('click', () => this.exportar('pdf'));

        const btnExcel = document.getElementById('btn-export-excel');
        if (btnExcel) btnExcel.addEventListener('click', () => this.exportar('excel'));

        const btnJson = document.getElementById('btn-export-json');
        if (btnJson) btnJson.addEventListener('click', () => this.exportar('json'));
    },

    async exportar(formato) {
        const tipoRelatorio = document.getElementById('rel-tipo')?.value || 'financeiro';
        const config = (await dbService.getById('configuracoes', 'main')) || {};

        if (formato === 'json') {
            const dbData = await dbService.exportFullDatabase();
            Utils.exportToJSON(`LavaJato_Backup_${Utils.getTodayISO()}`, dbData);
            return;
        }

        let title = '';
        let headers = [];
        let rows = [];
        let jsonExportData = [];

        if (tipoRelatorio === 'financeiro' || tipoRelatorio === 'lucros') {
            title = 'Relatório de Receitas e Lançamentos Financeiros';
            headers = ['Data', 'Cliente', 'Serviço', 'Forma Pagto', 'Valor'];
            const receitas = (await dbService.getAll('receitas')).filter(BusinessRules.isActive);

            rows = receitas.map(r => [
                Utils.formatDate(r.data),
                r.cliente || 'Cliente Avulso',
                r.servico || '-',
                r.formaPagamento || 'Pix',
                Utils.formatCurrency(r.valor)
            ]);

            jsonExportData = receitas.map(r => ({
                Data: Utils.formatDate(r.data),
                Cliente: r.cliente || 'Cliente Avulso',
                Servico: r.servico || '-',
                FormaPagamento: r.formaPagamento || 'Pix',
                Valor: r.valor
            }));
        } else if (tipoRelatorio === 'despesas' || tipoRelatorio === 'custos') {
            title = 'Relatório de Despesas (Fixas e Variáveis)';
            headers = ['Data', 'Tipo', 'Categoria', 'Item', 'Valor'];
            const despesas = (await dbService.getAll('despesas')).filter(BusinessRules.isActive);

            rows = despesas.map(d => [
                Utils.formatDate(d.data),
                d.tipo === 'fixa' ? 'Fixa' : 'Variável',
                d.categoria || '-',
                d.item || '-',
                Utils.formatCurrency(d.valor)
            ]);

            jsonExportData = despesas.map(d => ({
                Data: Utils.formatDate(d.data),
                Tipo: d.tipo,
                Categoria: d.categoria,
                Item: d.item,
                Valor: d.valor
            }));
        } else if (tipoRelatorio === 'estoque') {
            title = 'Relatório de Posição de Estoque';
            headers = ['Produto', 'Categoria', 'Quantidade', 'Valor Unit', 'Valor Total', 'Status'];
            const estoque = (await dbService.getAll('estoque')).filter(BusinessRules.isActive);

            rows = estoque.map(e => {
                const qtd = parseFloat(e.quantidade) || 0;
                const vUnit = parseFloat(e.valorUnitario) || 0;
                const min = parseFloat(e.quantidadeMinima) || 0;
                return [
                    e.nome,
                    e.categoria || '-',
                    `${qtd} ${e.unidade}`,
                    Utils.formatCurrency(vUnit),
                    Utils.formatCurrency(qtd * vUnit),
                    qtd <= min ? 'CRÍTICO' : 'Normal'
                ];
            });

            jsonExportData = estoque.map(e => ({
                Produto: e.nome,
                Categoria: e.categoria,
                Quantidade: e.quantidade,
                Unidade: e.unidade,
                ValorUnitario: e.valorUnitario,
                ValorTotal: (e.quantidade || 0) * (e.valorUnitario || 0)
            }));
        } else if (tipoRelatorio === 'funcionarios') {
            title = 'Relatório de Desempenho e Comissões da Equipe';
            headers = ['Nome', 'Cargo', 'Salário Base', 'Receita no mês', 'Comissão no mês', 'Admissão'];
            const funcionarios = (await dbService.getAll('funcionarios')).filter(BusinessRules.isActive);
            const receitas = (await dbService.getAll('receitas')).filter(BusinessRules.isActive);

            rows = funcionarios.map(f => {
                const performance = BusinessRules.getEmployeePerformance(f, receitas);
                return [f.nome, f.cargo || 'Lavador', Utils.formatCurrency(f.salario),
                    Utils.formatCurrency(performance.receita), Utils.formatCurrency(performance.comissao),
                    Utils.formatDate(f.dataAdmissao)];
            });

            jsonExportData = funcionarios.map(f => ({
                Nome: f.nome,
                Cargo: f.cargo,
                Salario: f.salario,
                ComissaoPercent: f.comissaoPercent,
                DataAdmissao: f.dataAdmissao
            }));
        } else if (tipoRelatorio === 'servicos') {
            title = 'Relatório de Serviços e Precificação';
            headers = ['Serviço', 'Categoria', 'Preço Cobrado', 'Custo Total', 'Lucro Bruto', 'Margem (%)'];
            const servicos = (await dbService.getAll('servicos')).filter(BusinessRules.isActive);

            rows = servicos.map(s => {
                const preco = parseFloat(s.valorCobrado) || 0;
                const custo = (parseFloat(s.custoOperacional) || 0) + (parseFloat(s.custoMateriais) || 0);
                const lucro = preco - custo;
                const margem = preco > 0 ? (lucro / preco) * 100 : 0;
                return [
                    s.nome,
                    s.categoria || 'Geral',
                    Utils.formatCurrency(preco),
                    Utils.formatCurrency(custo),
                    Utils.formatCurrency(lucro),
                    Utils.formatPercent(margem)
                ];
            });

            jsonExportData = servicos;
        } else {
            // KPIs
            title = 'Relatório Consolidado de Indicadores (KPIs)';
            headers = ['Indicador', 'Valor'];
            const receitas = await dbService.getAll('receitas');
            const despesas = await dbService.getAll('despesas');
            const estoque = await dbService.getAll('estoque');
            const funcionarios = await dbService.getAll('funcionarios');

            const kpis = Utils.calculateKPIs(receitas, despesas, estoque, funcionarios);

            rows = [
                ['Receita do Mês', Utils.formatCurrency(kpis.totalReceita)],
                ['Lucro Bruto', Utils.formatCurrency(kpis.lucroBruto)],
                ['Lucro Líquido', Utils.formatCurrency(kpis.lucroLiquido)],
                ['Margem Líquida', Utils.formatPercent(kpis.margemLiquida)],
                ['Ticket Médio', Utils.formatCurrency(kpis.ticketMedio)],
                ['Ponto de Equilíbrio', Utils.formatCurrency(kpis.pontoEquilibrio)],
                ['Total em Estoque', Utils.formatCurrency(kpis.valorEstoque)],
                ['Veículos Atendidos', `${kpis.qtdVeiculos} veículos`],
                ['Clientes Atendidos', `${kpis.qtdClientes} clientes`]
            ];

            jsonExportData = rows.map(r => ({ Indicador: r[0], Valor: r[1] }));
        }

        const filename = `Relatorio_${tipoRelatorio}_${Utils.getTodayISO()}`;

        if (formato === 'pdf') {
            Utils.exportToPDF(filename, title, headers, rows, config);
        } else if (formato === 'excel') {
            Utils.exportToExcel(filename, jsonExportData, tipoRelatorio);
        }
    }
};


window.RelatoriosModule = RelatoriosModule;
