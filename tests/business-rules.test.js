const test = require('node:test');
const assert = require('node:assert/strict');
const Rules = require('../js/business-rules.js');

test('datas ISO são interpretadas no calendário local sem deslocar o dia', () => {
    const date = Rules.parseISODate('2026-08-05');
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 7);
    assert.equal(date.getDate(), 5);
    assert.equal(Rules.toLocalISO(date), '2026-08-05');
    assert.equal(Rules.parseISODate('2026-02-30'), null);
});

test('KPIs financeiros usam somente o mês atual e ignoram estornos', () => {
    const result = Rules.calculateKPIs({
        referenceDate: new Date(2026, 7, 20, 12),
        receitas: [
            { data: '2026-08-01', valor: 100, cliente: 'Ana' },
            { data: '2026-08-02', valor: 50, cliente: 'Cliente Avulso' },
            { data: '2026-07-31', valor: 900, cliente: 'Antigo' },
            { data: '2026-08-03', valor: 999, status: 'estornado', ativo: false }
        ],
        despesas: [
            { data: '2026-08-05', valor: 30, tipo: 'variavel' },
            { data: '2026-08-06', valor: 20, tipo: 'fixa' },
            { data: '2026-07-01', valor: 500, tipo: 'fixa' }
        ]
    });
    assert.equal(result.totalReceita, 150);
    assert.equal(result.totalDespesas, 50);
    assert.equal(result.lucroBruto, 120);
    assert.equal(result.lucroLiquido, 100);
    assert.equal(result.ticketMedio, 75);
    assert.equal(result.qtdClientes, 1);
});

test('funcionário desativado sai da equipe e da folha sem apagar histórico', () => {
    const employees = [
        { id: 1, nome: 'Ativo', salario: 2000, ativo: true },
        { id: 2, nome: 'Desligado', salario: 3000, ativo: false }
    ];
    const result = Rules.calculateKPIs({ referenceDate: new Date(2026, 7, 5), funcionarios: employees });
    assert.equal(result.funcAtivos, 1);
    assert.equal(result.folhaAtiva, 2000);
});

test('comissão usa o percentual congelado no atendimento', () => {
    const employee = { id: 7, nome: 'Carlos', comissaoPercent: 20 };
    const performance = Rules.getEmployeePerformance(employee, [
        { data: '2026-08-05', valor: 100, funcionarioId: 7, comissaoPercentSnapshot: 8 },
        { data: '2026-08-06', valor: 50, funcionarioId: 7, comissaoPercentSnapshot: 10 },
        { data: '2026-07-06', valor: 1000, funcionarioId: 7, comissaoPercentSnapshot: 10 }
    ], new Date(2026, 7, 10));
    assert.equal(performance.receita, 150);
    assert.equal(performance.atendimentos, 2);
    assert.equal(performance.comissao, 13);
});

test('precificação entrega a margem desejada e rejeita divisor impossível', () => {
    const result = Rules.calculateServicePrice({ material: 50, taxPercent: 10, targetMarginPercent: 40 });
    assert.equal(result.valid, true);
    assert.equal(result.recommendedPrice, 100);
    assert.equal(result.profit, 40);
    assert.equal(result.effectiveMargin, 40);
    assert.equal(Rules.calculateServicePrice({ material: 50, taxPercent: 60, targetMarginPercent: 40 }).valid, false);
});
