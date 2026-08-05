/**
 * Funcionários Module (Staff, Productivity, Serviced Vehicles & Commissions)
 */

const FuncionariosModule = {
    editingId: null,

    async init() {
        await this.render();
    },

    async render() {
        const funcionarios = await dbService.getAll('funcionarios');
        const receitas = await dbService.getAll('receitas');
        const tbody = document.getElementById('tbody-funcionarios');
        if (!tbody) return;

        let totalFolha = 0;
        let totalComissoesGeral = 0;

        if (funcionarios.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400 text-sm">Nenhum funcionário cadastrado.</td></tr>`;
        } else {
            tbody.innerHTML = funcionarios.map(f => {
                const salario = parseFloat(f.salario) || 0;
                const comissaoPercent = parseFloat(f.comissaoPercent) || 0;
                totalFolha += salario;

                // Receita produzida e veículos por este funcionário
                let recProduzida = 0;
                let veiculosAtendidos = 0;

                receitas.forEach(r => {
                    if (r.funcionario && r.funcionario.trim().toLowerCase() === f.nome.trim().toLowerCase()) {
                        recProduzida += parseFloat(r.valor) || 0;
                        veiculosAtendidos++;
                    }
                });

                const valorComissao = (recProduzida * comissaoPercent) / 100;
                totalComissoesGeral += valorComissao;

                return `
                    <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td class="py-3.5 px-4 text-xs font-bold text-slate-800 dark:text-slate-100">${f.nome}</td>
                        <td class="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">${f.cargo || 'Lavador'}</td>
                        <td class="py-3.5 px-4 text-xs font-medium text-slate-500 dark:text-slate-400">${Utils.formatDate(f.dataAdmissao)}</td>
                        <td class="py-3.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 text-right">${Utils.formatCurrency(salario)}</td>
                        <td class="py-3.5 px-4 text-xs font-bold text-center text-blue-600 dark:text-blue-400">${veiculosAtendidos} veículos</td>
                        <td class="py-3.5 px-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 text-right">${Utils.formatCurrency(recProduzida)}</td>
                        <td class="py-3.5 px-4 text-xs font-bold text-purple-600 dark:text-purple-400 text-right">
                            ${Utils.formatCurrency(valorComissao)} <span class="text-[10px] text-slate-400">(${comissaoPercent}%)</span>
                        </td>
                        <td class="py-3.5 px-4 text-xs text-right">
                            <div class="flex items-center justify-end gap-1.5">
                                <button onclick="FuncionariosModule.openModal(${f.id})" title="Editar" class="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 p-1.5 transition">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button onclick="FuncionariosModule.delete(${f.id})" title="Excluir" class="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1.5 transition">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const elFolha = document.getElementById('func-folha-total');
        const elComissao = document.getElementById('func-comissoes-total');

        if (elFolha) elFolha.innerText = Utils.formatCurrency(totalFolha);
        if (elComissao) elComissao.innerText = Utils.formatCurrency(totalComissoesGeral);
    },

    async openModal(id = null) {
        this.editingId = id;
        const modalTitle = document.getElementById('func-modal-title');

        if (id) {
            const item = await dbService.getById('funcionarios', id);
            if (!item) return;

            if (modalTitle) modalTitle.innerText = 'Editar Funcionário';
            document.getElementById('func-nome').value = item.nome || '';
            document.getElementById('func-cargo').value = item.cargo || 'Lavador';
            document.getElementById('func-salario').value = item.salario || 0;
            document.getElementById('func-comissao').value = item.comissaoPercent || 0;
            document.getElementById('func-admissao').value = item.dataAdmissao || Utils.getTodayISO();
        } else {
            if (modalTitle) modalTitle.innerText = 'Novo Funcionário';
            document.getElementById('func-nome').value = '';
            document.getElementById('func-cargo').value = 'Lavador';
            document.getElementById('func-salario').value = '';
            document.getElementById('func-comissao').value = 8;
            document.getElementById('func-admissao').value = Utils.getTodayISO();
        }

        document.getElementById('modal-funcionario').classList.remove('hidden');
    },

    async save(e) {
        e.preventDefault();
        const nome = document.getElementById('func-nome').value;
        const cargo = document.getElementById('func-cargo').value;
        const salario = parseFloat(document.getElementById('func-salario').value) || 0;
        const comissaoPercent = parseFloat(document.getElementById('func-comissao').value) || 0;
        const dataAdmissao = document.getElementById('func-admissao').value;

        if (!nome || salario <= 0) {
            Utils.showToast('Preencha o nome e o salário do funcionário.', 'error');
            return;
        }

        const data = {
            nome,
            cargo,
            salario,
            comissaoPercent,
            dataAdmissao
        };

        if (this.editingId) {
            data.id = this.editingId;
            await dbService.update('funcionarios', data);
            Utils.showToast('Dados do funcionário atualizados!', 'success');
        } else {
            await dbService.add('funcionarios', data);
            Utils.showToast('Novo funcionário adicionado à equipe!', 'success');
        }

        document.getElementById('modal-funcionario').classList.add('hidden');
        await App.refreshAllData();
    },

    async delete(id) {
        if (confirm('Tem certeza que deseja apagar este funcionário?')) {
            await dbService.delete('funcionarios', id);
            Utils.showToast('Funcionário removido.', 'info');
            await App.refreshAllData();
        }
    }
};


window.FuncionariosModule = FuncionariosModule;
