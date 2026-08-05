/**
 * Serviços Module (Catalog, Pricing & Margins)
 */

const ServicosModule = {
    editingId: null,

    async init() {
        await this.render();
    },

    async render() {
        const servicos = (await dbService.getAll('servicos')).filter(BusinessRules.isActive);
        const funcionarios = (await dbService.getAll('funcionarios')).filter(BusinessRules.isActive);
        const tbody = document.getElementById('tbody-servicos');
        if (!tbody) return;

        if (servicos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-slate-400 text-sm">Nenhum serviço cadastrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = servicos.map(s => {
            const valorCobrado = parseFloat(s.valorCobrado) || 0;
            const custoOp = parseFloat(s.custoOperacional) || 0;
            const custoMat = parseFloat(s.custoMateriais) || 0;
            const custoTotal = custoOp + custoMat;
            const lucroBruto = valorCobrado - custoTotal;
            const margemLucro = valorCobrado > 0 ? (lucroBruto / valorCobrado) * 100 : 0;

            const margemBadge = margemLucro >= 50 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200'
                : margemLucro >= 30
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200';

            return `
                <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td class="py-3.5 px-4 text-xs font-bold text-slate-800 dark:text-slate-100">${Utils.escapeHTML(s.nome)}</td>
                    <td class="py-3.5 px-4 text-xs">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            ${Utils.escapeHTML(s.categoria || 'Geral')}
                        </span>
                    </td>
                    <td class="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">${s.tempoMedioMin || 30} min</td>
                    <td class="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">${Utils.escapeHTML(s.funcionarioResponsavel || 'Qualquer')}</td>
                    <td class="py-3.5 px-4 text-xs font-semibold text-rose-600 dark:text-rose-400 text-right">${Utils.formatCurrency(custoTotal)}</td>
                    <td class="py-3.5 px-4 text-xs font-bold text-blue-600 dark:text-blue-400 text-right">${Utils.formatCurrency(valorCobrado)}</td>
                    <td class="py-3.5 px-4 text-xs font-bold text-emerald-600 dark:text-emerald-400 text-right">${Utils.formatCurrency(lucroBruto)}</td>
                    <td class="py-3.5 px-4 text-xs text-right">
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-bold border ${margemBadge}">
                            ${Utils.formatPercent(margemLucro)}
                        </span>
                    </td>
                    <td class="py-3.5 px-4 text-xs text-right">
                        <div class="flex items-center justify-end gap-2">
                            <button onclick="ServicosModule.openModal(${s.id})" class="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 p-1.5 transition">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="ServicosModule.delete(${s.id})" class="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1.5 transition">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async openModal(id = null) {
        this.editingId = id;
        const funcionarios = (await dbService.getAll('funcionarios')).filter(BusinessRules.isActive);
        const selectFunc = document.getElementById('serv-func');

        if (selectFunc) {
            selectFunc.innerHTML = '<option value="">Qualquer funcionário</option>' + 
                funcionarios.map(f => `<option value="${f.nome}">${f.nome} (${f.cargo})</option>`).join('');
        }

        const modalTitle = document.getElementById('serv-modal-title');

        if (id) {
            const item = await dbService.getById('servicos', id);
            if (!item) return;

            if (modalTitle) modalTitle.innerText = 'Editar Serviço';
            document.getElementById('serv-nome').value = item.nome || '';
            document.getElementById('serv-categoria').value = item.categoria || 'Lavagem';
            document.getElementById('serv-valor').value = item.valorCobrado || 0;
            document.getElementById('serv-tempo').value = item.tempoMedioMin || 30;
            document.getElementById('serv-func').value = item.funcionarioResponsavel || '';
            document.getElementById('serv-custo-op').value = item.custoOperacional || 0;
            document.getElementById('serv-custo-mat').value = item.custoMateriais || 0;
        } else {
            if (modalTitle) modalTitle.innerText = 'Novo Serviço';
            document.getElementById('serv-nome').value = '';
            document.getElementById('serv-categoria').value = 'Lavagem';
            document.getElementById('serv-valor').value = '';
            document.getElementById('serv-tempo').value = 35;
            document.getElementById('serv-custo-op').value = '';
            document.getElementById('serv-custo-mat').value = '';
        }

        document.getElementById('modal-servico').classList.remove('hidden');
    },

    async save(e) {
        e.preventDefault();
        const nome = document.getElementById('serv-nome').value;
        const categoria = document.getElementById('serv-categoria').value;
        const valorCobrado = parseFloat(document.getElementById('serv-valor').value) || 0;
        const tempoMedioMin = parseInt(document.getElementById('serv-tempo').value) || 30;
        const funcionarioResponsavel = document.getElementById('serv-func').value;
        const custoOperacional = parseFloat(document.getElementById('serv-custo-op').value) || 0;
        const custoMateriais = parseFloat(document.getElementById('serv-custo-mat').value) || 0;

        if (!nome || valorCobrado <= 0) {
            Utils.showToast('Informe o nome e um valor válido para o serviço.', 'error');
            return;
        }
        const duplicate = (await dbService.getAll('servicos')).some((item) =>
            BusinessRules.isActive(item) && item.id !== this.editingId
            && BusinessRules.normalizeText(item.nome) === BusinessRules.normalizeText(nome));
        if (duplicate) {
            Utils.showToast('Já existe um serviço ativo com este nome.', 'error');
            return;
        }

        const data = {
            nome,
            categoria,
            valorCobrado,
            tempoMedioMin,
            funcionarioResponsavel,
            custoOperacional,
            custoMateriais,
            ativo: true
        };

        if (this.editingId) {
            data.id = this.editingId;
            await dbService.update('servicos', data);
            Utils.showToast('Serviço atualizado com sucesso!', 'success');
        } else {
            await dbService.add('servicos', data);
            Utils.showToast('Novo serviço cadastrado!', 'success');
        }

        document.getElementById('modal-servico').classList.add('hidden');
        await App.refreshAllData();
    },

    async delete(id) {
        if (confirm('Arquivar este serviço? Os atendimentos antigos permanecerão preservados.')) {
            const service = await dbService.getById('servicos', id);
            if (!service) return;
            service.ativo = false;
            service.arquivadoEm = new Date().toISOString();
            await dbService.update('servicos', service);
            Utils.showToast('Serviço arquivado com histórico preservado.', 'info');
            await App.refreshAllData();
        }
    }
};


window.ServicosModule = ServicosModule;
