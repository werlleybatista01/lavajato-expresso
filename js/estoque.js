/**
 * Estoque Module (Inventory Control, Movements & Low Stock Alerts)
 */

const EstoqueModule = {
    editingId: null,

    async init() {
        await this.render();
    },

    async render() {
        const estoque = await dbService.getAll('estoque');
        const tbody = document.getElementById('tbody-estoque');
        if (!tbody) return;

        let totalGeralEstoque = 0;
        let qtdAlertaBaixo = 0;

        if (estoque.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-slate-400 text-sm">Nenhum produto cadastrado no estoque.</td></tr>`;
        } else {
            tbody.innerHTML = estoque.map(item => {
                const qtd = parseFloat(item.quantidade) || 0;
                const vUnit = parseFloat(item.valorUnitario) || 0;
                const vTotal = qtd * vUnit;
                const qMin = parseFloat(item.quantidadeMinima) || 0;
                totalGeralEstoque += vTotal;

                const isLow = qtd <= qMin;
                if (isLow) qtdAlertaBaixo++;

                // Consumo estimado: 0.15 unidades por atendimento. 
                // Dias restantes = quantidade / (consumo_diario)
                const consumoDiarioEstimado = 0.2; // 0.2 unidades/dia por produto
                const diasRestantes = consumoDiarioEstimado > 0 ? Math.round(qtd / consumoDiarioEstimado) : 999;

                const statusBadge = isLow 
                    ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200">
                         <i class="fa-solid fa-triangle-exclamation mr-1"></i> Baixo (${qtd}/${qMin})
                       </span>`
                    : `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200">
                         <i class="fa-solid fa-check mr-1"></i> Normal
                       </span>`;

                return `
                    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td class="py-3.5 px-4 text-xs font-bold text-slate-800 dark:text-slate-100">${item.nome}</td>
                        <td class="py-3.5 px-4 text-xs">
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                ${item.categoria || 'Geral'}
                            </span>
                        </td>
                        <td class="py-3.5 px-4 text-xs font-bold text-slate-700 dark:text-slate-200">${qtd} ${item.unidade || 'Un'}</td>
                        <td class="py-3.5 px-4 text-xs font-medium text-slate-600 dark:text-slate-400 text-right">${Utils.formatCurrency(vUnit)}</td>
                        <td class="py-3.5 px-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 text-right">${Utils.formatCurrency(vTotal)}</td>
                        <td class="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">~${diasRestantes} dias</td>
                        <td class="py-3.5 px-4 text-xs">${statusBadge}</td>
                        <td class="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">${item.fornecedor || '-'}</td>
                        <td class="py-3.5 px-4 text-xs text-right">
                            <div class="flex items-center justify-end gap-1.5">
                                <button onclick="EstoqueModule.openMovimentacaoModal(${item.id})" title="Registrar Entrada/Saída" class="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-400 p-1.5 transition">
                                    <i class="fa-solid fa-right-left"></i>
                                </button>
                                <button onclick="EstoqueModule.openModal(${item.id})" title="Editar Item" class="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 p-1.5 transition">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button onclick="EstoqueModule.delete(${item.id})" title="Excluir Item" class="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1.5 transition">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const elTotal = document.getElementById('est-valor-total-geral');
        const elQtdAlertas = document.getElementById('est-qtd-alertas');

        if (elTotal) elTotal.innerText = Utils.formatCurrency(totalGeralEstoque);
        if (elQtdAlertas) {
            elQtdAlertas.innerText = `${qtdAlertaBaixo} produto(s) com estoque crítico`;
            elQtdAlertas.className = `text-xs font-semibold ${qtdAlertaBaixo > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`;
        }
    },

    async openModal(id = null) {
        this.editingId = id;
        const modalTitle = document.getElementById('est-modal-title');

        if (id) {
            const item = await dbService.getById('estoque', id);
            if (!item) return;

            if (modalTitle) modalTitle.innerText = 'Editar Item do Estoque';
            document.getElementById('est-nome').value = item.nome || '';
            document.getElementById('est-categoria').value = item.categoria || 'Químicos';
            document.getElementById('est-quantidade').value = item.quantidade || 0;
            document.getElementById('est-unidade').value = item.unidade || 'Galao';
            document.getElementById('est-valor-unit').value = item.valorUnitario || 0;
            document.getElementById('est-qtd-min').value = item.quantidadeMinima || 1;
            document.getElementById('est-fornecedor').value = item.fornecedor || '';
            document.getElementById('est-data-compra').value = item.dataCompra || Utils.getTodayISO();
        } else {
            if (modalTitle) modalTitle.innerText = 'Novo Item no Estoque';
            document.getElementById('est-nome').value = '';
            document.getElementById('est-categoria').value = 'Químicos';
            document.getElementById('est-quantidade').value = '';
            document.getElementById('est-unidade').value = 'Galao';
            document.getElementById('est-valor-unit').value = '';
            document.getElementById('est-qtd-min').value = 2;
            document.getElementById('est-fornecedor').value = '';
            document.getElementById('est-data-compra').value = Utils.getTodayISO();
        }

        document.getElementById('modal-estoque').classList.remove('hidden');
    },

    async save(e) {
        e.preventDefault();
        const nome = document.getElementById('est-nome').value;
        const categoria = document.getElementById('est-categoria').value;
        const quantidade = parseFloat(document.getElementById('est-quantidade').value) || 0;
        const unidade = document.getElementById('est-unidade').value;
        const valorUnitario = parseFloat(document.getElementById('est-valor-unit').value) || 0;
        const quantidadeMinima = parseFloat(document.getElementById('est-qtd-min').value) || 0;
        const fornecedor = document.getElementById('est-fornecedor').value;
        const dataCompra = document.getElementById('est-data-compra').value;

        if (!nome || quantidade < 0 || valorUnitario < 0) {
            Utils.showToast('Preencha os dados do produto corretamente.', 'error');
            return;
        }

        const data = {
            nome,
            categoria,
            quantidade,
            unidade,
            valorUnitario,
            quantidadeMinima,
            fornecedor,
            dataCompra
        };

        if (this.editingId) {
            data.id = this.editingId;
            await dbService.update('estoque', data);
            Utils.showToast('Produto atualizado!', 'success');
        } else {
            await dbService.add('estoque', data);
            Utils.showToast('Produto cadastrado no estoque!', 'success');
        }

        document.getElementById('modal-estoque').classList.add('hidden');
        await App.refreshAllData();
    },

    async openMovimentacaoModal(id) {
        const item = await dbService.getById('estoque', id);
        if (!item) return;

        document.getElementById('mov-item-id').value = item.id;
        document.getElementById('mov-item-nome').innerText = `${item.nome} (Atual: ${item.quantidade} ${item.unidade})`;
        document.getElementById('mov-qtd').value = 1;
        document.getElementById('mov-motivo').value = '';

        document.getElementById('modal-movimentacao').classList.remove('hidden');
    },

    async saveMovimentacao(e) {
        e.preventDefault();
        const id = parseInt(document.getElementById('mov-item-id').value);
        const tipo = document.getElementById('mov-tipo').value; // 'entrada' ou 'saida'
        const qtdMov = parseFloat(document.getElementById('mov-qtd').value) || 0;
        const motivo = document.getElementById('mov-motivo').value;

        const item = await dbService.getById('estoque', id);
        if (!item || qtdMov <= 0) {
            Utils.showToast('Quantidade inválida para movimentação.', 'error');
            return;
        }

        if (tipo === 'saida' && item.quantidade < qtdMov) {
            Utils.showToast(`Estoque insuficiente! Você tem apenas ${item.quantidade} ${item.unidade}(s).`, 'error');
            return;
        }

        const novaQtd = tipo === 'entrada' ? item.quantidade + qtdMov : item.quantidade - qtdMov;
        item.quantidade = novaQtd;
        await dbService.update('estoque', item);

        // Record history
        await dbService.add('movimentacoes', {
            data: Utils.getTodayISO(),
            tipo,
            quantidade: qtdMov,
            produtoId: id,
            produtoNome: item.nome,
            motivo
        });

        Utils.showToast(`Movimentação de ${tipo.toUpperCase()} realizada com sucesso!`, 'success');
        document.getElementById('modal-movimentacao').classList.add('hidden');

        await App.refreshAllData();
    },

    async delete(id) {
        if (confirm('Tem certeza que deseja apagar este item do estoque?')) {
            await dbService.delete('estoque', id);
            Utils.showToast('Item excluído.', 'info');
            await App.refreshAllData();
        }
    }
};


window.EstoqueModule = EstoqueModule;
