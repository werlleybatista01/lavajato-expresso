/**
 * Regras de negócio puras. Este arquivo não acessa DOM nem IndexedDB para que
 * os cálculos possam ser testados de forma determinística.
 */
const BusinessRules = (() => {
    const toNumber = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    };

    const normalizeText = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const parseISODate = (value) => {
        if (value instanceof Date) return new Date(value.getTime());
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
            ? date
            : null;
    };

    const toLocalISO = (value = new Date()) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const isActive = (record) => record && record.ativo !== false && record.status !== 'estornado';

    const inRange = (record, start, end) => {
        const date = parseISODate(record?.data);
        return date && date >= start && date < end;
    };

    const getRanges = (referenceDate = new Date()) => {
        const ref = referenceDate instanceof Date ? new Date(referenceDate) : new Date(referenceDate);
        const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearEnd = new Date(today.getFullYear() + 1, 0, 1);
        return { today, tomorrow, weekStart, monthStart, monthEnd, yearStart, yearEnd };
    };

    const getEmployeePerformance = (employee, receitas = [], referenceDate = new Date()) => {
        const { monthStart, monthEnd } = getRanges(referenceDate);
        let receita = 0;
        let atendimentos = 0;
        let comissao = 0;

        receitas.filter(isActive).filter((item) => inRange(item, monthStart, monthEnd)).forEach((item) => {
            const idMatches = item.funcionarioId != null && employee.id != null
                && Number(item.funcionarioId) === Number(employee.id);
            const legacyNameMatches = item.funcionarioId == null
                && normalizeText(item.funcionario || item.funcionarioNome) === normalizeText(employee.nome);
            if (!idMatches && !legacyNameMatches) return;

            const value = toNumber(item.valor);
            const rate = item.comissaoPercentSnapshot != null
                ? toNumber(item.comissaoPercentSnapshot)
                : toNumber(employee.comissaoPercent);
            receita += value;
            atendimentos += 1;
            comissao += value * rate / 100;
        });

        return { receita, atendimentos, comissao };
    };

    const calculateServicePrice = ({ material = 0, minutes = 0, laborHour = 0, utilitiesMinute = 0,
        allocatedFixedCost = 0, taxPercent = 0, targetMarginPercent = 0 } = {}) => {
        const directCost = toNumber(material) + (toNumber(minutes) / 60 * toNumber(laborHour))
            + (toNumber(minutes) * toNumber(utilitiesMinute)) + toNumber(allocatedFixedCost);
        const taxRate = toNumber(taxPercent) / 100;
        const marginRate = toNumber(targetMarginPercent) / 100;
        const divisor = 1 - taxRate - marginRate;
        if (directCost < 0 || taxRate < 0 || marginRate < 0 || divisor <= 0) {
            return { valid: false, directCost, minimumPrice: 0, recommendedPrice: 0, profit: 0, effectiveMargin: 0 };
        }
        const recommendedPrice = directCost / divisor;
        const minimumPrice = taxRate < 1 ? directCost / (1 - taxRate) : 0;
        const profit = recommendedPrice - directCost - recommendedPrice * taxRate;
        return {
            valid: true, directCost, minimumPrice, recommendedPrice, profit,
            effectiveMargin: recommendedPrice ? profit / recommendedPrice * 100 : 0
        };
    };

    const calculateKPIs = ({
        receitas = [], despesas = [], estoque = [], funcionarios = [], referenceDate = new Date()
    } = {}) => {
        const ranges = getRanges(referenceDate);
        const validReceitas = receitas.filter(isActive).filter((item) => parseISODate(item.data));
        const validDespesas = despesas.filter(isActive).filter((item) => parseISODate(item.data));
        const receitasMes = validReceitas.filter((item) => inRange(item, ranges.monthStart, ranges.monthEnd));
        const despesasMes = validDespesas.filter((item) => inRange(item, ranges.monthStart, ranges.monthEnd));
        const funcionariosAtivos = funcionarios.filter(isActive);

        const sum = (items) => items.reduce((total, item) => total + toNumber(item.valor), 0);
        const recDia = sum(validReceitas.filter((item) => inRange(item, ranges.today, ranges.tomorrow)));
        const recSemana = sum(validReceitas.filter((item) => inRange(item, ranges.weekStart, ranges.tomorrow)));
        const recMes = sum(receitasMes);
        const recAno = sum(validReceitas.filter((item) => inRange(item, ranges.yearStart, ranges.yearEnd)));
        const despesasFixas = sum(despesasMes.filter((item) => item.tipo === 'fixa'));
        const despesasVariaveis = sum(despesasMes.filter((item) => item.tipo !== 'fixa'));
        const totalDespesas = despesasFixas + despesasVariaveis;
        const lucroBruto = recMes - despesasVariaveis;
        const lucroLiquido = recMes - totalDespesas;
        const qtdVeiculos = receitasMes.length;
        const ticketMedio = qtdVeiculos ? recMes / qtdVeiculos : 0;
        const clientesUnicos = new Set(receitasMes
            .map((item) => normalizeText(item.cliente))
            .filter((name) => name && name !== 'cliente avulso'));
        const margemBruta = recMes > 0 ? lucroBruto / recMes * 100 : 0;
        const margemLiquida = recMes > 0 ? lucroLiquido / recMes * 100 : 0;
        const razaoVariavel = recMes > 0 ? despesasVariaveis / recMes : 0;
        const pontoEquilibrio = razaoVariavel < 1 ? despesasFixas / (1 - razaoVariavel) : null;
        const valorEstoque = estoque.filter(isActive).reduce((total, item) =>
            total + toNumber(item.quantidade) * toNumber(item.valorUnitario), 0);
        const folhaAtiva = funcionariosAtivos.reduce((total, item) => total + toNumber(item.salario), 0);
        const comissoesMes = funcionariosAtivos.reduce((total, employee) =>
            total + getEmployeePerformance(employee, receitasMes, referenceDate).comissao, 0);

        return {
            recDia, recSemana, recMes, recAno,
            totalReceita: recMes,
            totalReceitaAcumulada: sum(validReceitas),
            despesasFixas, despesasVariaveis, totalDespesas,
            lucroBruto, lucroLiquido, ticketMedio,
            qtdClientes: clientesUnicos.size,
            qtdVeiculos, margemBruta, margemLiquida, pontoEquilibrio,
            valorEstoque,
            funcAtivos: funcionariosAtivos.length,
            recPorFuncionario: funcionariosAtivos.length ? recMes / funcionariosAtivos.length : 0,
            folhaAtiva,
            comissoesMes
        };
    };

    return { toNumber, normalizeText, parseISODate, toLocalISO, isActive, getRanges, getEmployeePerformance, calculateServicePrice, calculateKPIs };
})();

if (typeof window !== 'undefined') window.BusinessRules = BusinessRules;
if (typeof module !== 'undefined' && module.exports) module.exports = BusinessRules;
