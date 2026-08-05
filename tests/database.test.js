const test = require('node:test');
const assert = require('node:assert/strict');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
const Rules = require('../js/business-rules.js');

global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;
global.BusinessRules = Rules;
const DatabaseService = require('../js/database.js');

test('movimentação de estoque grava saldo e histórico na mesma transação', async () => {
    const service = new DatabaseService();
    service.dbName = `CarWashDB-test-${Date.now()}`;
    await service.init();
    await service.clearStore('estoque');
    await service.clearStore('movimentacoes');
    const id = await service.add('estoque', { nome: 'Shampoo', quantidade: 10, unidade: 'L', ativo: true });

    const balance = await service.moveStock({ itemId: id, tipo: 'saida', quantidade: 3, motivo: 'Lavagem' });
    assert.equal(balance, 7);
    assert.equal((await service.getById('estoque', id)).quantidade, 7);
    const movements = await service.getAll('movimentacoes');
    assert.equal(movements.length, 1);
    assert.equal(movements[0].saldoAnterior, 10);
    assert.equal(movements[0].saldoPosterior, 7);

    await assert.rejects(() => service.moveStock({ itemId: id, tipo: 'saida', quantidade: 99 }), /Estoque insuficiente/);
    assert.equal((await service.getById('estoque', id)).quantidade, 7);
});

test('migração preserva dados antigos e cria vínculos estáveis por ID', async () => {
    const service = new DatabaseService();
    service.dbName = `CarWashDB-migration-${Date.now()}`;
    await service.init();
    const employeeId = await service.add('funcionarios', {
        nome: 'José da Silva', salario: 2000, comissaoPercent: 9
    });
    const serviceId = await service.add('servicos', {
        nome: 'Lavagem Completa', valorCobrado: 80, custoOperacional: 10, custoMateriais: 5
    });
    const revenueId = await service.add('receitas', {
        data: '2026-08-05', valor: 80, funcionario: 'Jose da Silva', servico: 'lavagem completa'
    });

    await service.migrateLegacyData(true);
    const revenue = await service.getById('receitas', revenueId);
    assert.equal(revenue.funcionarioId, employeeId);
    assert.equal(revenue.comissaoPercentSnapshot, 9);
    assert.equal(revenue.servicoId, serviceId);
    assert.equal(revenue.custoServicoSnapshot, 15);
    assert.equal(revenue.ativo, true);
});
