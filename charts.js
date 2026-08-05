/**
 * Chart Manager for Car Wash ERP using Chart.js
 */

class ChartManager {
    constructor() {
        this.instances = {};
        this.isDark = document.documentElement.classList.contains('dark');
    }

    setTheme(isDark) {
        this.isDark = isDark;
    }

    getThemeColors() {
        if (this.isDark) {
            return {
                text: '#94a3b8',       // Slate-400
                border: '#334155',     // Slate-700
                grid: 'rgba(255, 255, 255, 0.05)',
                cardBg: '#1e293b'
            };
        }
        return {
            text: '#64748b',       // Slate-500
            border: '#e2e8f0',     // Slate-200
            grid: 'rgba(0, 0, 0, 0.04)',
            cardBg: '#ffffff'
        };
    }

    destroyChart(id) {
        if (this.instances[id]) {
            this.instances[id].destroy();
            delete this.instances[id];
        }
    }

    // 1. Receita Diária (Últimos 7 dias)
    renderReceitaDiariaChart(canvasId, receitas = []) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const colors = this.getThemeColors();
        const daysMap = {};
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
            daysMap[iso] = { label, total: 0 };
        }

        receitas.forEach(r => {
            if (daysMap[r.data]) {
                daysMap[r.data].total += parseFloat(r.valor) || 0;
            }
        });

        const labels = Object.values(daysMap).map(item => item.label);
        const data = Object.values(daysMap).map(item => item.total);

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Receita (R$)',
                    data,
                    backgroundColor: 'rgba(37, 99, 235, 0.85)', // Blue 600
                    borderColor: '#2563eb',
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `Receita: ${Utils.formatCurrency(ctx.raw)}`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
                    y: {
                        ticks: {
                            color: colors.text,
                            callback: (val) => 'R$ ' + val
                        },
                        grid: { color: colors.grid }
                    }
                }
            }
        });
    }

    // 2. Receita Mensal vs Meta
    renderReceitaMensalChart(canvasId, receitas = [], metaMensal = 35000) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const colors = this.getThemeColors();
        const monthsMap = {};
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            monthsMap[monthKey] = { label, receita: 0, meta: metaMensal };
        }

        receitas.forEach(r => {
            const mKey = r.data ? r.data.substring(0, 7) : '';
            if (monthsMap[mKey]) {
                monthsMap[mKey].receita += parseFloat(r.valor) || 0;
            }
        });

        const labels = Object.values(monthsMap).map(m => m.label);
        const dataReceita = Object.values(monthsMap).map(m => m.receita);
        const dataMeta = Object.values(monthsMap).map(m => m.meta);

        this.instances[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Receita Realizada (R$)',
                        data: dataReceita,
                        borderColor: '#10b981', // Emerald 500
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 3
                    },
                    {
                        label: 'Meta Mensal (R$)',
                        data: dataMeta,
                        borderColor: '#f59e0b', // Amber 500
                        borderDash: [5, 5],
                        fill: false,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: colors.text } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${Utils.formatCurrency(ctx.raw)}`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
                    y: { ticks: { color: colors.text }, grid: { color: colors.grid } }
                }
            }
        });
    }

    // 3. Custos & Despesas (Fixas vs Variáveis)
    renderDespesasPieChart(canvasId, despesas = []) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const colors = this.getThemeColors();
        const catMap = {};

        despesas.forEach(d => {
            const cat = d.categoria || 'Outros';
            catMap[cat] = (catMap[cat] || 0) + (parseFloat(d.valor) || 0);
        });

        const labels = Object.keys(catMap);
        const data = Object.values(catMap);
        const palette = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

        this.instances[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: palette.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: colors.cardBg
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: colors.text, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${Utils.formatCurrency(ctx.raw)}`
                        }
                    }
                }
            }
        });
    }

    // 4. Fluxo de Caixa (Entradas vs Saídas)
    renderFluxoCaixaChart(canvasId, receitas = [], despesas = []) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const colors = this.getThemeColors();
        const daysMap = {};
        const today = new Date();

        for (let i = 14; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            daysMap[iso] = { label, entradas: 0, saidas: 0 };
        }

        receitas.forEach(r => {
            if (daysMap[r.data]) daysMap[r.data].entradas += parseFloat(r.valor) || 0;
        });

        despesas.forEach(d => {
            if (daysMap[d.data]) daysMap[d.data].saidas += parseFloat(d.valor) || 0;
        });

        const labels = Object.values(daysMap).map(i => i.label);
        const entradas = Object.values(daysMap).map(i => i.entradas);
        const saidas = Object.values(daysMap).map(i => i.saidas);

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Entradas (Receitas)',
                        data: entradas,
                        backgroundColor: 'rgba(16, 185, 129, 0.85)'
                    },
                    {
                        label: 'Saídas (Despesas)',
                        data: saidas,
                        backgroundColor: 'rgba(239, 68, 68, 0.85)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: colors.text } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${Utils.formatCurrency(ctx.raw)}`
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
                    y: { ticks: { color: colors.text }, grid: { color: colors.grid } }
                }
            }
        });
    }

    // 5. Serviços Mais Vendidos
    renderServicosPopularesChart(canvasId, receitas = []) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const colors = this.getThemeColors();
        const servMap = {};

        receitas.forEach(r => {
            const sName = r.servico || 'Outros';
            servMap[sName] = (servMap[sName] || 0) + 1;
        });

        const sorted = Object.entries(servMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const labels = sorted.map(i => i[0]);
        const data = sorted.map(i => i[1]);

        this.instances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    axis: 'y',
                    label: 'Vendas (Qtd)',
                    data,
                    backgroundColor: 'rgba(139, 92, 246, 0.85)', // Purple 500
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: colors.text, precision: 0 }, grid: { color: colors.grid } },
                    y: { ticks: { color: colors.text }, grid: { color: colors.grid } }
                }
            }
        });
    }

    // 6. Desempenho dos Funcionários (Receita Produzida)
    renderFuncionariosChart(canvasId, receitas = []) {
        this.destroyChart(canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const colors = this.getThemeColors();
        const funcMap = {};

        receitas.forEach(r => {
            const func = r.funcionario || 'Não Atribuído';
            funcMap[func] = (funcMap[func] || 0) + (parseFloat(r.valor) || 0);
        });

        const labels = Object.keys(funcMap);
        const data = Object.values(funcMap);

        this.instances[canvasId] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: ['#06b6d4', '#f97316', '#84cc16', '#eab308', '#a855f7'],
                    borderColor: colors.cardBg,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: colors.text } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${Utils.formatCurrency(ctx.raw)}`
                        }
                    }
                }
            }
        });
    }
}

const chartManager = new ChartManager();


window.chartManager = chartManager;
