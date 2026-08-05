/**
 * Utility Functions for Car Wash ERP Dashboard
 */

const Utils = {
    // Formatting
    formatCurrency(val) {
        const num = parseFloat(val) || 0;
        return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    formatNumber(val, decimals = 0) {
        const num = parseFloat(val) || 0;
        return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },

    formatPercent(val, decimals = 1) {
        const num = parseFloat(val) || 0;
        return `${num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('pt-BR');
    },

    formatISOToInput(dateStr) {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        return new Date(dateStr).toISOString().split('T')[0];
    },

    getTodayISO() {
        return new Date().toISOString().split('T')[0];
    },

    // Financial & KPI Calculations
    calculateKPIs(receitas = [], despesas = [], estoque = [], funcionarios = [], servicos = []) {
        const now = new Date();
        const todayStr = this.getTodayISO();
        
        // Date range calculations
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        let recDia = 0, recSemana = 0, recMes = 0, recAno = 0, totalReceita = 0;
        let totalAtendimentos = receitas.length;
        const clientesUnicos = new Set();

        receitas.forEach(r => {
            const rVal = parseFloat(r.valor) || 0;
            const rDate = new Date(r.data);
            totalReceita += rVal;
            if (r.cliente) clientesUnicos.add(r.cliente.trim().toLowerCase());

            if (r.data === todayStr) recDia += rVal;
            if (rDate >= startOfWeek) recSemana += rVal;
            if (rDate >= startOfMonth) recMes += rVal;
            if (rDate >= startOfYear) recAno += rVal;
        });

        let despesasFixas = 0;
        let despesasVariaveis = 0;

        despesas.forEach(d => {
            const dVal = parseFloat(d.valor) || 0;
            if (d.tipo === 'fixa') {
                despesasFixas += dVal;
            } else {
                despesasVariaveis += dVal;
            }
        });

        const totalDespesas = despesasFixas + despesasVariaveis;
        const lucroBruto = totalReceita - despesasVariaveis;
        const lucroLiquido = totalReceita - totalDespesas;
        const ticketMedio = totalAtendimentos > 0 ? totalReceita / totalAtendimentos : 0;
        const margemBruta = totalReceita > 0 ? (lucroBruto / totalReceita) * 100 : 0;
        const margemLiquida = totalReceita > 0 ? (lucroLiquido / totalReceita) * 100 : 0;

        // Break-even point (Ponto de Equilíbrio em R$)
        // Formula: Custos Fixos / (1 - (Custos Variáveis / Receita))
        const razVariavel = totalReceita > 0 ? (despesasVariaveis / totalReceita) : 0;
        const pontoEquilibrio = razVariavel < 1 ? despesasFixas / (1 - razVariavel) : 0;

        // Stock value
        let valorEstoque = 0;
        estoque.forEach(i => {
            valorEstoque += (parseFloat(i.quantidade) || 0) * (parseFloat(i.valorUnitario) || 0);
        });

        // Employees KPI
        const funcAtivos = funcionarios.length;
        const recPorFuncionario = funcAtivos > 0 ? totalReceita / funcAtivos : 0;

        return {
            recDia,
            recSemana,
            recMes,
            recAno,
            totalReceita,
            despesasFixas,
            despesasVariaveis,
            totalDespesas,
            lucroBruto,
            lucroLiquido,
            ticketMedio,
            qtdClientes: clientesUnicos.size || totalAtendimentos,
            qtdVeiculos: totalAtendimentos,
            margemBruta,
            margemLiquida,
            pontoEquilibrio,
            valorEstoque,
            funcAtivos,
            recPorFuncionario
        };
    },

    // UI Toast Notification
    showToast(message, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const bgColors = {
            success: 'bg-emerald-600 text-white border-emerald-500',
            error: 'bg-rose-600 text-white border-rose-500',
            warning: 'bg-amber-500 text-white border-amber-400',
            info: 'bg-blue-600 text-white border-blue-500'
        };

        const icons = {
            success: 'fa-circle-check',
            error: 'fa-circle-xmark',
            warning: 'fa-triangle-exclamation',
            info: 'fa-circle-info'
        };

        toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all transform duration-300 translate-y-4 opacity-0 ${bgColors[type] || bgColors.info}`;
        toast.innerHTML = `
            <i class="fa-solid ${icons[type] || icons.info} text-lg"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('translate-y-4', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-4');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // Exports
    exportToExcel(filename, dataArray, sheetName = 'Dados') {
        if (!window.XLSX) {
            this.showToast('Biblioteca SheetJS não carregada', 'error');
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(dataArray);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, `${filename}.xlsx`);
        this.showToast(`Relatório ${filename}.xlsx exportado com sucesso!`, 'success');
    },

    exportToPDF(filename, title, headers, rows, companyInfo = {}) {
        if (!window.jspdf) {
            this.showToast('Biblioteca jsPDF não carregada', 'error');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59); // Slate-800
        doc.text(companyInfo.nomeEmpresa || 'Lava-Jato ERP', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // Slate-500
        doc.text(`Relatório: ${title}`, 14, 27);
        doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 32);

        if (companyInfo.cnpj) {
            doc.text(`CNPJ: ${companyInfo.cnpj} | Tel: ${companyInfo.telefone || '-'}`, 14, 37);
        }

        doc.setLineWidth(0.5);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 42, 196, 42);

        // Table
        if (doc.autoTable) {
            doc.autoTable({
                startY: 47,
                head: [headers],
                body: rows,
                theme: 'striped',
                headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                styles: { fontSize: 9, cellPadding: 3 }
            });
        } else {
            let y = 50;
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            rows.forEach(row => {
                doc.text(row.join(' | '), 14, y);
                y += 7;
            });
        }

        doc.save(`${filename}.pdf`);
        this.showToast(`Relatório ${filename}.pdf baixado com sucesso!`, 'success');
    },

    exportToJSON(filename, dataObj) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataObj, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${filename}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        this.showToast(`Backup ${filename}.json gerado com sucesso!`, 'success');
    }
};


window.Utils = Utils;
