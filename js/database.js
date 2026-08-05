/**
 * Database Service using IndexedDB for Car Wash ERP
 */

class DatabaseService {
    constructor() {
        this.dbName = 'CarWashDB';
        this.dbVersion = 2;
        this.db = null;
        this.initPromise = null;
        this.enableDemoSeed = false;
        this.stores = [
            'receitas',
            'despesas',
            'servicos',
            'estoque',
            'funcionarios',
            'clientes',
            'configuracoes',
            'movimentacoes',
            'simulacoes',
            'backup'
        ];
    }

    async init() {
        if (this.db) return this.db;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.stores.forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        if (storeName === 'configuracoes') {
                            db.createObjectStore(storeName, { keyPath: 'id' });
                        } else {
                            db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                        }
                    }
                });
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this.seedInitialDataIfEmpty();
                await this.migrateLegacyData();
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB Error:', event.target.error);
                reject(event.target.error);
            };
        });

        return this.initPromise;
    }

    async ensureDb() {
        if (!this.db) {
            await this.init();
        }
    }

    // Generic CRUD Operations
    async getAll(storeName) {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async getById(storeName, id) {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async add(storeName, item) {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            item.criadoEm = item.criadoEm || new Date().toISOString();
            const request = store.add(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, item) {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            item.atualizadoEm = new Date().toISOString();
            const request = store.put(item);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async clearStore(storeName) {
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async resetDatabase() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.initPromise = null;
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('Feche outras abas do sistema antes de apagar a base.'));
        });
    }

    // Export & Import full database
    async exportFullDatabase() {
        await this.ensureDb();
        const fullBackup = {};
        for (const storeName of this.stores) {
            fullBackup[storeName] = await this.getAll(storeName);
        }
        return fullBackup;
    }

    async importFullDatabase(data) {
        await this.ensureDb();
        if (!data || typeof data !== 'object') throw new Error('Backup inválido.');
        const selectedStores = this.stores.filter((name) => Array.isArray(data[name]));
        if (!selectedStores.length) throw new Error('Backup sem tabelas reconhecidas.');

        await new Promise((resolve, reject) => {
            const tx = this.db.transaction(selectedStores, 'readwrite');
            selectedStores.forEach((storeName) => {
                const store = tx.objectStore(storeName);
                store.clear();
                data[storeName].forEach((item) => store.put(item));
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Importação cancelada.'));
        });
        await this.migrateLegacyData(true);
    }

    async migrateLegacyData(force = false) {
        const config = await this.getById('configuracoes', 'main');
        if (!force && Number(config?.schemaVersion || 0) >= 2) return;

        const funcionarios = await this.getAll('funcionarios');
        const byName = new Map(funcionarios.map((employee) => [BusinessRules.normalizeText(employee.nome), employee]));
        const servicos = await this.getAll('servicos');
        const servicesByName = new Map(servicos.map((service) => [BusinessRules.normalizeText(service.nome), service]));
        const storesWithActiveFlag = ['funcionarios', 'servicos', 'estoque', 'receitas', 'despesas'];

        for (const storeName of storesWithActiveFlag) {
            const records = await this.getAll(storeName);
            for (const record of records) {
                let changed = false;
                if (record.ativo == null && record.status !== 'estornado') {
                    record.ativo = true;
                    changed = true;
                }
                if (storeName === 'receitas' && record.funcionarioId == null) {
                    const employee = byName.get(BusinessRules.normalizeText(record.funcionario || record.funcionarioNome));
                    if (employee) {
                        record.funcionarioId = employee.id;
                        record.funcionarioNome = employee.nome;
                        record.comissaoPercentSnapshot = BusinessRules.toNumber(employee.comissaoPercent);
                        changed = true;
                    }
                }
                if (storeName === 'receitas' && record.servicoId == null) {
                    const service = servicesByName.get(BusinessRules.normalizeText(record.servico || record.servicoNome));
                    if (service) {
                        record.servicoId = service.id;
                        record.servicoNome = service.nome;
                        record.custoServicoSnapshot = BusinessRules.toNumber(service.custoOperacional)
                            + BusinessRules.toNumber(service.custoMateriais);
                        changed = true;
                    }
                }
                if (changed) await this.update(storeName, record);
            }
        }

        await this.update('configuracoes', { ...(config || { id: 'main' }), schemaVersion: 2 });
    }

    async moveStock({ itemId, tipo, quantidade, motivo = '', data }) {
        await this.ensureDb();
        const amount = BusinessRules.toNumber(quantidade);
        if (!Number.isInteger(Number(itemId)) || amount <= 0 || !['entrada', 'saida'].includes(tipo)) {
            throw new Error('Movimentação de estoque inválida.');
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['estoque', 'movimentacoes'], 'readwrite');
            const stockStore = tx.objectStore('estoque');
            const movementStore = tx.objectStore('movimentacoes');
            const getRequest = stockStore.get(Number(itemId));
            let newQuantity = null;

            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (!item || item.ativo === false) {
                    tx.abort();
                    reject(new Error('Item de estoque não encontrado ou inativo.'));
                    return;
                }
                const current = BusinessRules.toNumber(item.quantidade);
                if (tipo === 'saida' && current < amount) {
                    tx.abort();
                    reject(new Error(`Estoque insuficiente: saldo atual ${current} ${item.unidade || 'un'}.`));
                    return;
                }
                newQuantity = tipo === 'entrada' ? current + amount : current - amount;
                item.quantidade = newQuantity;
                item.atualizadoEm = new Date().toISOString();
                stockStore.put(item);
                movementStore.add({
                    data: data || BusinessRules.toLocalISO(), tipo, quantidade: amount,
                    produtoId: item.id, produtoNome: item.nome, motivo,
                    saldoAnterior: current, saldoPosterior: newQuantity,
                    criadoEm: new Date().toISOString()
                });
            };
            getRequest.onerror = () => reject(getRequest.error);
            tx.oncomplete = () => resolve(newQuantity);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => { if (newQuantity != null) reject(tx.error || new Error('Movimentação cancelada.')); };
        });
    }

    // Seed realistic demo data if fresh DB
    async seedInitialDataIfEmpty() {
        const config = await this.getById('configuracoes', 'main');
        if (config) return; // Already seeded

        console.log('Seeding initial Car Wash data...');

        // 1. Configurações da Empresa
        await this.update('configuracoes', {
            id: 'main',
            nomeEmpresa: 'Lava Jato Expresso',
            cnpj: '',
            telefone: '',
            endereco: '',
            logo: '',
            metaMensal: 35000,
            valorAguaM3: 8.50, // R$ por m³
            valorKwh: 0.85,    // R$ por kWh
            horarioFuncionamento: 'Segunda a Sábado, 08:00 às 18:00'
        });

        // Produção inicia vazia. A massa abaixo existe apenas para testes/desenvolvimento explícito.
        if (!this.enableDemoSeed) return;

        // 2. Funcionários
        const sampleFuncionarios = [
            { nome: 'Carlos Eduardo (Kadu)', cargo: 'Lavador Líder', salario: 2400, comissaoPercent: 10, dataAdmissao: '2025-01-15' },
            { nome: 'Marcos Vinícius', cargo: 'Detailer / Polidor', salario: 2800, comissaoPercent: 12, dataAdmissao: '2025-03-01' },
            { nome: 'Ana Paula', cargo: 'Atendente / Caixa', salario: 1900, comissaoPercent: 3, dataAdmissao: '2025-02-10' },
            { nome: 'Lucas Gabriel', cargo: 'Lavador Auxiliar', salario: 1600, comissaoPercent: 8, dataAdmissao: '2025-05-20' }
        ];

        for (const f of sampleFuncionarios) {
            await this.add('funcionarios', f);
        }

        // 3. Serviços
        const sampleServicos = [
            { nome: 'Lavagem Simples + Pretinho', categoria: 'Lavagem', valorCobrado: 45, tempoMedioMin: 35, funcionarioResponsavel: 'Lucas Gabriel', custoOperacional: 12, custoMateriais: 4 },
            { nome: 'Lavagem Completa com Cera Líquida', categoria: 'Lavagem Especial', valorCobrado: 80, tempoMedioMin: 50, funcionarioResponsavel: 'Carlos Eduardo (Kadu)', custoOperacional: 20, custoMateriais: 8 },
            { nome: 'Higienização Interna Completa + Extratora', categoria: 'Estética', valorCobrado: 280, tempoMedioMin: 180, funcionarioResponsavel: 'Marcos Vinícius', custoOperacional: 65, custoMateriais: 25 },
            { nome: 'Polimento Técnico + Vitrificação de Pintura', categoria: 'Estética Premium', valorCobrado: 650, tempoMedioMin: 360, funcionarioResponsavel: 'Marcos Vinícius', custoOperacional: 140, custoMateriais: 85 },
            { nome: 'Limpeza e Hidratação de Bancos de Couro', categoria: 'Estética', valorCobrado: 150, tempoMedioMin: 75, funcionarioResponsavel: 'Carlos Eduardo (Kadu)', custoOperacional: 35, custoMateriais: 18 },
            { nome: 'Lavagem Detalhada de Motor', categoria: 'Especial', valorCobrado: 120, tempoMedioMin: 60, funcionarioResponsavel: 'Lucas Gabriel', custoOperacional: 25, custoMateriais: 15 }
        ];

        for (const s of sampleServicos) {
            await this.add('servicos', s);
        }

        // 4. Estoque de Produtos
        const sampleEstoque = [
            { nome: 'Shampoo Neutro Concentrado (5L)', categoria: 'Químicos', quantidade: 4, unidade: 'Galao', valorUnitario: 85, quantidadeMinima: 2, fornecedor: 'AutoDetailing Pro', dataCompra: '2026-07-15' },
            { nome: 'Desengraxante APC Multiuso (5L)', categoria: 'Químicos', quantidade: 3, unidade: 'Galao', valorUnitario: 75, quantidadeMinima: 2, fornecedor: 'AutoDetailing Pro', dataCompra: '2026-07-20' },
            { nome: 'Cera Carnaúba em Spray (1L)', categoria: 'Proteção', quantidade: 6, unidade: 'Frasco', valorUnitario: 42, quantidadeMinima: 3, fornecedor: 'Vonixx Rep', dataCompra: '2026-07-10' },
            { nome: 'Pretinho para Pneus High Shine (5L)', categoria: 'Acabamento', quantidade: 2, unidade: 'Galao', valorUnitario: 65, quantidadeMinima: 2, fornecedor: 'LavaRápido Distribuidora', dataCompra: '2026-07-01' },
            { nome: 'Panos de Microfibra 40x40cm 350GSM', categoria: 'Acessórios', quantidade: 45, unidade: 'Unidade', valorUnitario: 8.50, quantidadeMinima: 15, fornecedor: 'SuperPano', dataCompra: '2026-06-25' },
            { nome: 'Luvas de Microfibra para Lavagem', categoria: 'Acessórios', quantidade: 8, unidade: 'Unidade', valorUnitario: 22, quantidadeMinima: 4, fornecedor: 'SuperPano', dataCompra: '2026-06-25' },
            { nome: 'Escovas para Caixas de Roda e Rodas', categoria: 'Acessórios', quantidade: 5, unidade: 'Jogo', valorUnitario: 48, quantidadeMinima: 2, fornecedor: 'LavaRápido Distribuidora', dataCompra: '2026-05-18' },
            { nome: 'Vitrificador de Pintura 9H (50ml)', categoria: 'Proteção Premium', quantidade: 3, unidade: 'Frasco', valorUnitario: 190, quantidadeMinima: 1, fornecedor: 'Vonixx Rep', dataCompra: '2026-07-05' }
        ];

        for (const e of sampleEstoque) {
            await this.add('estoque', e);
        }

        // 5. Clientes
        const sampleClientes = [
            { nome: 'Roberto Almeida', telefone: '(27) 99123-4567', veiculo: 'Toyota Corolla 2023', placa: 'RBT-1A23', totalGasto: 450, ultimaVisita: '2026-08-04' },
            { nome: 'Juliana Costa', telefone: '(27) 99876-5432', veiculo: 'Jeep Compass 2022', placa: 'JLC-9B87', totalGasto: 680, ultimaVisita: '2026-08-03' },
            { nome: 'Fernando Machado', telefone: '(27) 99555-4433', veiculo: 'Honda Civic G10', placa: 'FNM-3C45', totalGasto: 920, ultimaVisita: '2026-08-05' },
            { nome: 'Patrícia Souza', telefone: '(27) 99222-1100', veiculo: 'Hyundai HB20 2024', placa: 'PTS-4D56', totalGasto: 240, ultimaVisita: '2026-08-01' },
            { nome: 'Lucas Mendes', telefone: '(27) 99777-8899', veiculo: 'BMW 320i M Sport', placa: 'LCM-8E90', totalGasto: 1450, ultimaVisita: '2026-08-05' }
        ];

        for (const c of sampleClientes) {
            await this.add('clientes', c);
        }

        // 6. Despesas Fixas e Variáveis
        const sampleDespesas = [
            // Fixas
            { data: '2026-08-01', categoria: 'Aluguel', tipo: 'fixa', item: 'Aluguel do Galpão Comercial', valor: 3500, observacoes: 'Pago dia 01' },
            { data: '2026-08-02', categoria: 'Energia', tipo: 'fixa', item: 'Conta de Luz (EDP)', valor: 890, observacoes: 'Vencimento dia 10' },
            { data: '2026-08-02', categoria: 'Água', tipo: 'fixa', item: 'Conta de Água (Cesan)', valor: 1150, observacoes: 'Alto consumo lavagem' },
            { data: '2026-08-01', categoria: 'Internet', tipo: 'fixa', item: 'Fibra Óptica 600MB', valor: 149, observacoes: 'Vivo Fibra' },
            { data: '2026-08-05', categoria: 'Contador', tipo: 'fixa', item: 'Honorários Contábeis', valor: 650, observacoes: 'Mensalidade MEI/Simples' },
            { data: '2026-08-05', categoria: 'Salários', tipo: 'fixa', item: 'Folha de Pagamento Equipe', valor: 8700, observacoes: 'Inclui encargos' },
            { data: '2026-08-01', categoria: 'Sistemas', tipo: 'fixa', item: 'Licença Software / Automação', valor: 120, observacoes: 'ERP e WhatsApp Bot' },
            { data: '2026-08-03', categoria: 'Marketing', tipo: 'fixa', item: 'Anúncios Instagram / Google Ads', valor: 450, observacoes: 'Tráfego local' },
            
            // Variáveis
            { data: '2026-08-02', categoria: 'Shampoo', tipo: 'variavel', item: 'Reposicao Shampoo Neutro 5L', valor: 170, observacoes: '2 galões' },
            { data: '2026-08-03', categoria: 'Manutenção', tipo: 'variavel', item: 'Troca de Óleo Compressor de Ar', valor: 180, observacoes: 'Manutenção preventiva' },
            { data: '2026-08-04', categoria: 'Panos', tipo: 'variavel', item: 'Lote de Panos Microfibra 350GSM', valor: 170, observacoes: '20 panos novos' },
            { data: '2026-08-04', categoria: 'Produtos químicos', tipo: 'variavel', item: 'Compra de Pretinho e Cera Spray', valor: 214, observacoes: 'Distribuidora' }
        ];

        for (const d of sampleDespesas) {
            await this.add('despesas', d);
        }

        // 7. Receitas
        const today = new Date();
        const sampleReceitas = [];

        const formas = ['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro'];
        const servicoNomes = [
            { nome: 'Lavagem Completa com Cera Líquida', valor: 80, func: 'Carlos Eduardo (Kadu)' },
            { nome: 'Lavagem Simples + Pretinho', valor: 45, func: 'Lucas Gabriel' },
            { nome: 'Higienização Interna Completa + Extratora', valor: 280, func: 'Marcos Vinícius' },
            { nome: 'Polimento Técnico + Vitrificação de Pintura', valor: 650, func: 'Marcos Vinícius' },
            { nome: 'Limpeza e Hidratação de Bancos de Couro', valor: 150, func: 'Carlos Eduardo (Kadu)' },
            { nome: 'Lavagem Detalhada de Motor', valor: 120, func: 'Lucas Gabriel' }
        ];
        const clienteNomes = ['Roberto Almeida', 'Juliana Costa', 'Fernando Machado', 'Patrícia Souza', 'Lucas Mendes', 'Cliente Avulso', 'Marcelo Silva', 'Carla Fernandes'];

        for (let i = 9; i >= 0; i--) {
            const dateObj = new Date(today);
            dateObj.setDate(today.getDate() - i);
            const dateStr = BusinessRules.toLocalISO(dateObj);

            const salesCount = 3 + (i % 3);
            for (let s = 0; s < salesCount; s++) {
                const sItem = servicoNomes[(s + i) % servicoNomes.length];
                const cItem = clienteNomes[(s * 2 + i) % clienteNomes.length];
                const fItem = formas[(s + i) % formas.length];

                sampleReceitas.push({
                    data: dateStr,
                    cliente: cItem,
                    servico: sItem.nome,
                    formaPagamento: fItem,
                    valor: sItem.valor,
                    funcionario: sItem.func,
                    observacoes: `Atendimento ${s+1} do dia`
                });
            }
        }

        for (const r of sampleReceitas) {
            await this.add('receitas', r);
        }

        console.log('Seed completed successfully!');
    }
}

// Global Singleton
const dbService = new DatabaseService();
if (typeof window !== 'undefined') window.dbService = dbService;
if (typeof module !== 'undefined' && module.exports) module.exports = DatabaseService;
