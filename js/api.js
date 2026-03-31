/**
 * LotoQuant - API Client
 */
const API = {
    // ↓↓↓ COLOQUE SUA URL AQUI ↓↓↓
    baseUrl: localStorage.getItem('lotoquant_backend_url') || 'https://wanderhalleylee-loteria-halley-api.hf.space',
    apiKey: localStorage.getItem('lotoquant_api_key') || '',

    setBaseUrl(url) {
        this.baseUrl = url.replace(/\/$/, '');
        localStorage.setItem('lotoquant_backend_url', this.baseUrl);
    },

    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('lotoquant_api_key', this.apiKey);
    },

    async request(endpoint, options = {}) {
        if (!this.baseUrl) {
            throw new Error('Backend URL não configurada. Vá em "Inserir Dados" e configure.');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (this.apiKey) {
            headers['X-API-Key'] = this.apiKey;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Não foi possível conectar ao backend. Verifique a URL.');
            }
            throw error;
        }
    },

    // Resultados
    async getResultados(jogoSlug, limit = 20) {
        return this.request(`/api/resultados/?jogo_slug=${jogoSlug}&limit=${limit}`);
    },

    async getUltimoResultado(jogoSlug) {
        return this.request(`/api/resultados/ultimo?jogo_slug=${jogoSlug}`);
    },

    async inserirResultado(data) {
        return this.request('/api/resultados/', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async inserirBulk(resultados) {
        return this.request('/api/resultados/bulk', {
            method: 'POST',
            body: JSON.stringify(resultados)
        });
    },

    // Análises
    async getAnaliseCompleta(jogoSlug) {
        return this.request(`/api/analises/completa?jogo_slug=${jogoSlug}`);
    },

    async getRanking(jogoSlug) {
        return this.request(`/api/analises/ranking?jogo_slug=${jogoSlug}`);
    },

    async retreinar(jogoSlug) {
        return this.request(`/api/analises/retreinar?jogo_slug=${jogoSlug}`, {
            method: 'POST'
        });
    },

    // Previsões
    async gerarPrevisoes(jogoSlug, quantidade = 3) {
        return this.request('/api/previsoes/gerar', {
            method: 'POST',
            body: JSON.stringify({
                jogo_slug: jogoSlug,
                quantidade_jogos: quantidade
            })
        });
    },

    async getHistoricoPrevisoes(jogoSlug) {
        return this.request(`/api/previsoes/historico?jogo_slug=${jogoSlug}`);
    },

    async getUniversoReduzido(jogoSlug, tamanho = null) {
        let url = `/api/previsoes/universo-reduzido?jogo_slug=${jogoSlug}`;
        if (tamanho) url += `&tamanho=${tamanho}`;
        return this.request(url);
    },

    // Fechamento
    async gerarFechamento(jogoSlug, garantia = 'quadra', tamanhoUniverso = null) {
        let url = `/api/previsoes/fechamento?jogo_slug=${jogoSlug}&garantia=${garantia}`;
        if (tamanhoUniverso) url += `&tamanho_universo=${tamanhoUniverso}`;
        return this.request(url, { method: 'POST' });
    },

    // Backtesting
    async executarBacktest(jogoSlug, concursos = 50, cartelas = 3) {
        return this.request('/api/backtesting/executar', {
            method: 'POST',
            body: JSON.stringify({
                jogo_slug: jogoSlug,
                concursos_teste: concursos,
                cartelas_por_concurso: cartelas
            })
        });
    },

    // Alertas
    async getAlertas(jogoSlug = null) {
        let url = '/api/alertas/';
        if (jogoSlug) url += `?jogo_slug=${jogoSlug}`;
        return this.request(url);
    },

    async verificarAlertas(jogoSlug) {
        return this.request(`/api/alertas/verificar?jogo_slug=${jogoSlug}`, {
            method: 'POST'
        });
    },

    // Health
    async healthCheck() {
        return this.request('/health');
    }
};
