const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');

const root = path.resolve(__dirname, '..');

test('interface inicializa, navega, abre modal e recalcula equipe', async () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const dom = new JSDOM(html, { url: 'https://example.test/lavajato-expresso/', runScripts: 'outside-only' });
    const { window } = dom;
    window.indexedDB = indexedDB;
    window.IDBKeyRange = IDBKeyRange;
    window.confirm = () => true;
    window.alert = () => {};
    window.Chart = class { destroy() {} };
    window.XLSX = {};
    window.jspdf = {};

    const scripts = [
        'business-rules.js', 'utils.js', 'database.js', 'charts.js', 'dashboard.js',
        'financeiro.js', 'servicos.js', 'estoque.js', 'funcionarios.js',
        'simuladores.js', 'relatorios.js', 'app.js'
    ];
    scripts.forEach((name) => window.eval(fs.readFileSync(path.join(root, 'js', name), 'utf8')));
    await window.App.init();
    await window.dbService.add('funcionarios', { nome: 'Funcionário 1', cargo: 'Lavador', salario: 2000, comissaoPercent: 8, ativo: true });
    await window.dbService.add('funcionarios', { nome: 'Funcionário 2', cargo: 'Lavador', salario: 1800, comissaoPercent: 5, ativo: true });

    const financeiroLink = window.document.querySelector('.nav-link[data-tab="financeiro"]');
    financeiroLink.click();
    assert.equal(window.document.getElementById('view-financeiro').classList.contains('hidden'), false);

    window.FinanceiroModule.openNovaDespesaModal();
    assert.equal(window.document.getElementById('modal-despesa').classList.contains('hidden'), false);
    window.document.querySelector('#modal-despesa .btn-close-modal').click();
    assert.equal(window.document.getElementById('modal-despesa').classList.contains('hidden'), true);

    window.document.querySelector('.nav-link[data-tab="funcionarios"]').click();
    const before = (await window.dbService.getAll('funcionarios')).filter(window.BusinessRules.isActive);
    await window.FuncionariosModule.delete(before[0].id);
    const after = (await window.dbService.getAll('funcionarios')).filter(window.BusinessRules.isActive);
    assert.equal(after.length, before.length - 1);
    assert.doesNotMatch(window.document.getElementById('func-folha-total').textContent, /NaN/);

    await window.App.switchTab('dashboard');
    assert.equal(String(window.document.getElementById('kpi-func-ativos').innerText), String(after.length));

    dom.window.close();
});
