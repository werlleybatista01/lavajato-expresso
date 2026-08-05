/**
 * Main Application Orchestrator & Router
 */

const App = {
    currentTab: 'dashboard',

    async init() {
        console.log('Initializing Lava Jato Expresso ERP...');

        try {
            // Ensure IndexedDB ready
            await dbService.init();

            // Load saved theme
            this.initTheme();

            // Bind UI event listeners
            this.bindEvents();

            // Load company config into forms
            await this.loadConfiguracoes();

            // Initialize all modules
            if (window.DashboardModule) await DashboardModule.init();
            if (window.FinanceiroModule) await FinanceiroModule.init();
            if (window.ServicosModule) await ServicosModule.init();
            if (window.EstoqueModule) await EstoqueModule.init();
            if (window.FuncionariosModule) await FuncionariosModule.init();
            if (window.SimuladoresModule) await SimuladoresModule.init();
            if (window.RelatoriosModule) await RelatoriosModule.init();

            // Show default tab
            this.switchTab('dashboard');

            console.log('Car Wash ERP fully loaded and offline ready!');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            if (window.Utils) Utils.showToast('Erro ao carregar banco de dados local.', 'error');
        }
    },

    bindEvents() {
        // Global Click Event Delegation to fix all button clicks reliably
        document.addEventListener('click', (e) => {
            // 1. Navigation Links (data-tab)
            const navBtn = e.target.closest('[data-tab]');
            if (navBtn && navBtn.classList.contains('nav-link')) {
                e.preventDefault();
                const targetTab = navBtn.dataset.tab;
                if (targetTab) this.switchTab(targetTab);
                return;
            }

            // 2. Modal Close Buttons (.btn-close-modal)
            const closeBtn = e.target.closest('.btn-close-modal');
            if (closeBtn) {
                e.preventDefault();
                const modal = closeBtn.closest('.modal-backdrop');
                if (modal) modal.classList.add('hidden');
                return;
            }

            // 3. Modal Backdrop Click (click outside modal content)
            if (e.target.classList.contains('modal-backdrop')) {
                e.target.classList.add('hidden');
                return;
            }
        });

        // Sidebar Collapse Toggle
        const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
        if (btnToggleSidebar) {
            btnToggleSidebar.addEventListener('click', () => {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.toggle('collapsed');
            });
        }

        // Theme Toggle
        const btnTheme = document.getElementById('btn-toggle-theme');
        if (btnTheme) {
            btnTheme.addEventListener('click', () => this.toggleTheme());
        }

        // Config Form Save
        const formConfig = document.getElementById('form-configuracoes');
        if (formConfig) {
            formConfig.addEventListener('submit', (e) => this.saveConfiguracoes(e));
        }
    },

    switchTab(tabName) {
        this.currentTab = tabName;

        // Hide all views
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));

        // Show target view
        const targetSec = document.getElementById(`view-${tabName}`);
        if (targetSec) targetSec.classList.remove('hidden');

        // Update active sidebar link styling (Amber / Gold theme)
        document.querySelectorAll('.nav-link').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('bg-amber-500', 'text-zinc-950', 'font-black', 'shadow-lg', 'shadow-amber-500/20');
                btn.classList.remove('text-zinc-400', 'hover:bg-zinc-800', 'hover:text-zinc-200');
            } else {
                btn.classList.remove('bg-amber-500', 'text-zinc-950', 'font-black', 'shadow-lg', 'shadow-amber-500/20');
                btn.classList.add('text-zinc-400', 'hover:bg-zinc-800', 'hover:text-zinc-200');
            }
        });

        // Refresh tab data
        this.refreshTab(tabName);
    },

    async refreshTab(tabName) {
        if (tabName === 'dashboard' && window.DashboardModule) await DashboardModule.render();
        if (tabName === 'financeiro' && window.FinanceiroModule) await FinanceiroModule.render();
        if (tabName === 'servicos' && window.ServicosModule) await ServicosModule.render();
        if (tabName === 'estoque' && window.EstoqueModule) await EstoqueModule.render();
        if (tabName === 'funcionarios' && window.FuncionariosModule) await FuncionariosModule.render();
        if (tabName === 'simuladores' && window.SimuladoresModule) await SimuladoresModule.renderCurrentSubTab();
        if (tabName === 'configuracoes') await this.loadConfiguracoes();
    },

    async refreshAllData() {
        await this.refreshTab(this.currentTab);
    },

    // Theme Management
    initTheme() {
        const savedTheme = localStorage.getItem('carwash_theme') || 'dark';
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
            if (window.chartManager) chartManager.setTheme(true);
        } else {
            document.documentElement.classList.remove('dark');
            if (window.chartManager) chartManager.setTheme(false);
        }
    },

    toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('carwash_theme', isDark ? 'dark' : 'light');
        if (window.chartManager) chartManager.setTheme(isDark);
        Utils.showToast(`Modo ${isDark ? 'Escuro' : 'Claro'} ativado.`, 'info');
        this.refreshAllData();
    },

    // Company Settings
    async loadConfiguracoes() {
        const config = (await dbService.getById('configuracoes', 'main')) || {};
        
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        setVal('cfg-nome-empresa', config.nomeEmpresa || 'Lava Jato Expresso');
        setVal('cfg-cnpj', config.cnpj || '');
        setVal('cfg-telefone', config.telefone || '');
        setVal('cfg-endereco', config.endereco || '');
        setVal('cfg-meta-mensal', config.metaMensal || 35000);
        setVal('cfg-valor-agua', config.valorAguaM3 || 8.50);
        setVal('cfg-valor-kwh', config.valorKwh || 0.85);

        // Header Company Display
        const elHeaderNome = document.getElementById('topbar-company-name');
        if (elHeaderNome) elHeaderNome.innerText = config.nomeEmpresa || 'Lava Jato Expresso';
    },

    async saveConfiguracoes(e) {
        e.preventDefault();
        const nomeEmpresa = document.getElementById('cfg-nome-empresa').value;
        const cnpj = document.getElementById('cfg-cnpj').value;
        const telefone = document.getElementById('cfg-telefone').value;
        const endereco = document.getElementById('cfg-endereco').value;
        const metaMensal = parseFloat(document.getElementById('cfg-meta-mensal').value) || 35000;
        const valorAguaM3 = parseFloat(document.getElementById('cfg-valor-agua').value) || 8.50;
        const valorKwh = parseFloat(document.getElementById('cfg-valor-kwh').value) || 0.85;

        await dbService.update('configuracoes', {
            id: 'main',
            nomeEmpresa,
            cnpj,
            telefone,
            endereco,
            metaMensal,
            valorAguaM3,
            valorKwh
        });

        Utils.showToast('Configurações salvas com sucesso!', 'success');
        await this.loadConfiguracoes();
        await this.refreshAllData();
    },

    // Reset database to initial seed data
    async resetToSeedData() {
        if (confirm('Atenção: Isso irá restaurar o banco de dados para os dados de demonstração iniciais. Deseja continuar?')) {
            indexedDB.deleteDatabase('CarWashDB');
            Utils.showToast('Banco de dados resetado. Recarregando...', 'info');
            setTimeout(() => location.reload(), 1000);
        }
    }
};

window.App = App;

// Launch App when DOM Ready
document.addEventListener('DOMContentLoaded', () => App.init());
