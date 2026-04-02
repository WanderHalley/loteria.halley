// ============================================================
// js/app.js - LotoQuant Frontend v3.1 (Completo + Corrigido)
// Compatível com Backend API v3.2.0 (8 modelos de IA)
// Data: 2026-04-02
// ============================================================
const App = {

    // ==================== ESTADO ====================
    currentPage: 'dashboard',
    currentGame: 'mega-sena',
    config: {
        backendUrl: localStorage.getItem('lotoquant_backend_url') || '',
        apiKey: localStorage.getItem('lotoquant_api_key') || ''
    },
    jogosConfig: {
        'mega-sena':       { nome: 'Mega-Sena',    min: 1,  max: 60,  escolha: 6,  escolhaMin: 6,  escolhaMax: 6,  apiNome: 'megasena',       trevos: false },
        'lotofacil':       { nome: 'Lotofácil',     min: 1,  max: 25,  escolha: 15, escolhaMin: 15, escolhaMax: 20, apiNome: 'lotofacil',      trevos: false },
        'lotomania':       { nome: 'Lotomania',     min: 0,  max: 99,  escolha: 20, escolhaMin: 1,  escolhaMax: 50, apiNome: 'lotomania',      trevos: false },
        'mais-milionaria': { nome: '+Milionária',   min: 1,  max: 50,  escolha: 6,  escolhaMin: 6,  escolhaMax: 12, apiNome: 'maismilionaria', trevos: true, trevosMin: 1, trevosMax: 6, trevosEscolha: 2 }
    },
    _lastPrevisoes: [],
    _lastValidacao: null,
    _lastFechamento: [],

    // ==================== HELPERS ====================
    parseArray: function(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(function(n) { return parseInt(n, 10); }).filter(function(n) { return !isNaN(n); });
        if (typeof val === 'string') {
            val = val.trim();
            if (!val) return [];
            try {
                var parsed = JSON.parse(val);
                if (Array.isArray(parsed)) return parsed.map(function(n) { return parseInt(n, 10); }).filter(function(n) { return !isNaN(n); });
            } catch (e) { /* not JSON */ }
            var parts = val.split(/[,;\s]+/).filter(function(p) { return p.length > 0; });
            return parts.map(function(n) { return parseInt(n, 10); }).filter(function(n) { return !isNaN(n); });
        }
        if (typeof val === 'number' && !isNaN(val)) return [val];
        return [];
    },

    formatNumber: function(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    },

    formatPercent: function(v) {
        if (v == null || isNaN(v)) return '0%';
        return (v * 100).toFixed(1) + '%';
    },

    getScoreColor: function(score) {
        if (score >= 0.7) return '#27ae60';
        if (score >= 0.5) return '#f39c12';
        return '#e74c3c';
    },

    getClassificacaoLabel: function(c) {
        var map = { quente: '🔥 Quente', morno: '🌤 Morno', frio: '❄️ Frio' };
        return map[c] || c || '';
    },

    pad2: function(n) {
        return String(n).padStart(2, '0');
    },

    el: function(id) {
        return document.getElementById(id);
    },

    // ==================== STORAGE (Meus Jogos - localStorage) ====================
    getMeusJogos: function() {
        try { return JSON.parse(localStorage.getItem('lotoquant_meus_jogos') || '[]'); }
        catch (e) { return []; }
    },

    salvarMeusJogos: function(jogos) {
        localStorage.setItem('lotoquant_meus_jogos', JSON.stringify(jogos));
    },

    gerarId: function() {
        return 'jogo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    },

    // ==================== INIT ====================
    init: function() {
        var self = this;
        console.log('[LotoQuant] Inicializando v3.1...');
        self.setupNavigation();
        self.setupGameSelector();
        self.setupButtons();
        self.setupConfig();
        self.setupMeusJogos();
        self.showPage('dashboard');
        if (self.config.backendUrl) {
            self.loadDashboard();
        } else {
            var st = self.el('dashboard-status');
            if (st) st.innerHTML = '<p style="color:#f39c12;">⚠️ Configure a URL do backend em ⚙️ Configurações para começar.</p>';
        }
        console.log('[LotoQuant] Init completo.');
    },

    // ==================== NAVIGATION ====================
    setupNavigation: function() {
        var self = this;
        document.querySelectorAll('[data-page]').forEach(function(el) {
            el.addEventListener('click', function(e) {
                e.preventDefault();
                var page = el.getAttribute('data-page');
                self.showPage(page);
            });
        });
    },

    showPage: function(page) {
        this.currentPage = page;
        document.querySelectorAll('.page-content').forEach(function(p) {
            p.style.display = 'none';
        });
        var target = this.el('page-' + page);
        if (target) target.style.display = 'block';
        document.querySelectorAll('[data-page]').forEach(function(el) {
            if (el.getAttribute('data-page') === page) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        if (page === 'meus-jogos') this.renderMeusJogos();
    },

    // ==================== GAME SELECTOR ====================
    setupGameSelector: function() {
        var self = this;
        var sel = self.el('game-selector');
        if (!sel) return;
        sel.addEventListener('change', function() {
            self.currentGame = sel.value;
            if (self.config.backendUrl) self.loadDashboard();
        });
    },

    // ==================== CONFIG ====================
    setupConfig: function() {
        var self = this;
        var urlInput = self.el('config-backend-url');
        var keyInput = self.el('config-api-key');
        var btnSave  = self.el('btn-save-config');
        if (urlInput) urlInput.value = self.config.backendUrl;
        if (keyInput) keyInput.value = self.config.apiKey;
        if (btnSave) {
            btnSave.addEventListener('click', function() {
                var url = (urlInput ? urlInput.value : '').trim().replace(/\/+$/, '');
                var key = (keyInput ? keyInput.value : '').trim();
                self.config.backendUrl = url;
                self.config.apiKey = key;
                localStorage.setItem('lotoquant_backend_url', url);
                localStorage.setItem('lotoquant_api_key', key);
                self.showNotification('Configuração salva!', 'success');
                if (url) self.loadDashboard();
            });
        }
    },

    // ==================== BUTTONS ====================
    setupButtons: function() {
        var self = this;
        var bindings = {
            'btn-analise':            'executarAnalise',
            'btn-previsoes':          'gerarPrevisoes',
            'btn-validar':            'validarJogo',
            'btn-fechamento':         'gerarFechamento',
            'btn-backtest':           'executarBacktest',
            'btn-importar-todos':     'importarHistoricoProxy',
            'btn-importar-jogo':      'importarJogoIndividual',
            'btn-atualizar':          'forcarAtualizacao',
            'btn-alertas':            'verificarAlertas',
            'btn-retreinar':          'retreinarModelos',
            'btn-salvar-jogo':        'salvarJogoManual',
            'btn-importar-previsao':  'importarPrevisaoParaMeusJogos',
            'btn-importar-fechamento':'importarFechamentoParaMeusJogos',
            'btn-limpar-jogos':       'limparMeusJogos'
        };
        Object.keys(bindings).forEach(function(id) {
            var element = self.el(id);
            var method  = bindings[id];
            if (element && typeof self[method] === 'function') {
                element.addEventListener('click', function() { self[method](); });
            }
        });
    },

    // ==================== API REQUEST ====================
    apiRequest: function(endpoint, options) {
        var self = this;
        options = options || {};
        if (!self.config.backendUrl) {
            self.showNotification('Configure a URL do backend primeiro!', 'error');
            return Promise.reject(new Error('Backend URL não configurada'));
        }
        var url = self.config.backendUrl + endpoint;
        var headers = { 'Content-Type': 'application/json' };
        if (self.config.apiKey) headers['x-api-key'] = self.config.apiKey;
        var fetchOpts = Object.assign({}, options, {
            headers: Object.assign({}, headers, options.headers || {})
        });
        return fetch(url, fetchOpts).then(function(resp) {
            if (!resp.ok) {
                return resp.json().catch(function() { return { detail: resp.statusText }; }).then(function(errBody) {
                    throw new Error(errBody.detail || 'Erro ' + resp.status);
                });
            }
            return resp.json();
        });
    },

    // ==================== HELPERS: último concurso ====================
    getUltimoConcursoSalvo: function(jogo_slug) {
        return this.apiRequest('/api/resultados/?jogo_slug=' + jogo_slug + '&limit=1').then(function(data) {
            var resultados = data.resultados || [];
            var concurso = resultados.length > 0 ? (resultados[0].concurso || 0) : 0;
            var total = data.total || 0;
            return { concurso: concurso, total: total };
        }).catch(function() {
            return { concurso: 0, total: 0 };
        });
    },

    getUltimoConcursoCaixa: function(apiNome) {
        return fetch('https://servicebus2.caixa.gov.br/portaldeloterias/api/' + apiNome + '/').then(function(resp) {
            if (!resp.ok) return 0;
            return resp.json().then(function(d) { return d.numero || 0; });
        }).catch(function() { return 0; });
    },

    // ==================== DASHBOARD ====================
    loadDashboard: function() {
        var self = this;
        var statusEl = self.el('dashboard-status');
        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">⏳ Carregando dados do Supabase...</p>';

        var healthPromise = self.apiRequest('/health');
        var salvoPromise  = self.getUltimoConcursoSalvo(self.currentGame);
        var rankingPromise = self.apiRequest('/api/analises/ranking?jogo_slug=' + self.currentGame).catch(function() { return null; });

        Promise.all([healthPromise, salvoPromise, rankingPromise]).then(function(results) {
            var health  = results[0];
            var salvo   = results[1];
            var ranking = results[2];
            var cfg = self.jogosConfig[self.currentGame] || {};
            var modelos = health.modelos || [];

            var html = '';
            // Cards
            html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">';
            html += '<div style="background:#1a1a2e;padding:16px;border-radius:12px;border:1px solid #333;">';
            html += '  <div style="color:#888;font-size:12px;">Status Backend</div>';
            html += '  <div style="color:#27ae60;font-size:18px;font-weight:bold;">✅ v' + (health.version || '?') + '</div>';
            html += '</div>';
            html += '<div style="background:#1a1a2e;padding:16px;border-radius:12px;border:1px solid #333;">';
            html += '  <div style="color:#888;font-size:12px;">Modelos IA</div>';
            html += '  <div style="color:#00d4ff;font-size:18px;font-weight:bold;">' + modelos.length + ' ativos</div>';
            html += '</div>';
            html += '<div style="background:#1a1a2e;padding:16px;border-radius:12px;border:1px solid #333;">';
            html += '  <div style="color:#888;font-size:12px;">' + (cfg.nome || self.currentGame) + '</div>';
            html += '  <div style="color:#f39c12;font-size:18px;font-weight:bold;">' + self.formatNumber(salvo.total) + ' concursos</div>';
            html += '  <div style="color:#666;font-size:11px;">Último: #' + salvo.concurso + '</div>';
            html += '</div>';
            html += '<div style="background:#1a1a2e;padding:16px;border-radius:12px;border:1px solid #333;">';
            html += '  <div style="color:#888;font-size:12px;">Dados</div>';
            html += '  <div style="color:#9b59b6;font-size:18px;font-weight:bold;">Supabase ☁️</div>';
            html += '  <div style="color:#666;font-size:11px;">Persistentes na nuvem</div>';
            html += '</div>';
            html += '</div>';

            // Top 10
            if (ranking && ranking.ranking && ranking.ranking.length > 0) {
                var top10 = ranking.ranking.slice(0, 10);
                html += '<h3 style="color:#00d4ff;margin-bottom:12px;">🔥 Top 10 Números - ' + (cfg.nome || self.currentGame) + '</h3>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">';
                for (var i = 0; i < top10.length; i++) {
                    var n = top10[i];
                    var color = self.getScoreColor(n.score);
                    html += '<div style="background:#1a1a2e;border:2px solid ' + color + ';border-radius:50%;width:56px;height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;">';
                    html += '  <span style="color:#fff;font-weight:bold;font-size:16px;">' + self.pad2(n.numero) + '</span>';
                    html += '  <span style="color:' + color + ';font-size:10px;">' + (n.score * 100).toFixed(0) + '%</span>';
                    html += '</div>';
                }
                html += '</div>';
            }

            // Modelos
            var modelosNomes = {
                frequencia: 'Frequência', atraso: 'Atraso', padrao: 'Padrões',
                distribuicao: 'Distribuição', lstm: 'LSTM', xgboost: 'XGBoost',
                monte_carlo: 'Monte Carlo', bayesiano: 'Bayesiano'
            };
            html += '<h3 style="color:#00d4ff;margin-bottom:8px;">🤖 ' + modelos.length + ' Modelos de IA</h3>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">';
            for (var m = 0; m < modelos.length; m++) {
                html += '<span style="background:#16213e;color:#00d4ff;padding:6px 12px;border-radius:20px;font-size:12px;">' + (modelosNomes[modelos[m]] || modelos[m]) + '</span>';
            }
            html += '</div>';

            if (statusEl) statusEl.innerHTML = html;
        }).catch(function(err) {
            if (statusEl) statusEl.innerHTML = '<p style="color:#e74c3c;">❌ Erro: ' + err.message + '</p>';
        });
    },

    // ==================== ANÁLISE ====================
    executarAnalise: function() {
        var self = this;
        var statusEl = self.el('analise-resultado');
        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">⏳ Executando análise com 8 modelos de IA...</p>';

        self.apiRequest('/api/analises/completa?jogo_slug=' + self.currentGame).then(function(data) {
            var cfg = self.jogosConfig[self.currentGame] || {};
            var html = '<h3 style="color:#00d4ff;">Análise Completa - ' + (cfg.nome || self.currentGame) + '</h3>';
            html += '<p>Concursos analisados: <strong>' + (data.total_concursos || '?') + '</strong> | Último: <strong>#' + (data.ultimo_concurso || '?') + '</strong></p>';

            // Ranking table
            var ranking = data.ranking || [];
            if (ranking.length > 0) {
                html += '<h4 style="color:#f39c12;">Ranking dos Números</h4>';
                html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">';
                html += '<tr style="background:#16213e;color:#00d4ff;">';
                html += '<th style="padding:8px;">Nº</th><th>Score</th><th>Class.</th><th>Freq.G</th><th>Freq.R</th><th>Atraso</th>';
                html += '<th>Freq</th><th>Atr</th><th>Pad</th><th>Dist</th><th>LSTM</th><th>XGB</th><th>MC</th><th>Bay</th>';
                html += '</tr>';
                for (var i = 0; i < ranking.length; i++) {
                    var n = ranking[i];
                    var sc = n.scores_modelos || {};
                    var color = self.getScoreColor(n.score);
                    html += '<tr style="border-bottom:1px solid #333;">';
                    html += '<td style="padding:6px;font-weight:bold;color:#fff;">' + self.pad2(n.numero) + '</td>';
                    html += '<td style="color:' + color + ';font-weight:bold;">' + (n.score * 100).toFixed(1) + '%</td>';
                    html += '<td>' + self.getClassificacaoLabel(n.classificacao) + '</td>';
                    html += '<td>' + self.formatPercent(n.frequencia_geral) + '</td>';
                    html += '<td>' + self.formatPercent(n.frequencia_recente) + '</td>';
                    html += '<td>' + (n.atraso != null ? n.atraso : '-') + '</td>';
                    var modKeys = ['frequencia','atraso','padrao','distribuicao','lstm','xgboost','monte_carlo','bayesiano'];
                    for (var k = 0; k < modKeys.length; k++) {
                        var v = sc[modKeys[k]];
                        html += '<td>' + (v != null ? (v * 100).toFixed(0) : '-') + '</td>';
                    }
                    html += '</tr>';
                }
                html += '</table></div>';
            }

            // Pares frequentes
            var pares = data.pares_frequentes;
            if (pares && typeof pares === 'object') {
                html += '<h4 style="color:#f39c12;margin-top:16px;">Pares Mais Frequentes</h4>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
                var paresEntries = Array.isArray(pares) ? pares : Object.entries(pares);
                var count = 0;
                if (Array.isArray(pares)) {
                    for (var p = 0; p < pares.length && p < 20; p++) {
                        html += '<span style="background:#16213e;color:#00d4ff;padding:4px 10px;border-radius:12px;font-size:12px;">' + (pares[p].par || '?') + ': ' + (pares[p].frequencia || pares[p].count || '?') + 'x</span>';
                    }
                } else {
                    var keys = Object.keys(pares);
                    for (var pk = 0; pk < keys.length && pk < 20; pk++) {
                        html += '<span style="background:#16213e;color:#00d4ff;padding:4px 10px;border-radius:12px;font-size:12px;">' + keys[pk] + ': ' + pares[keys[pk]] + 'x</span>';
                    }
                }
                html += '</div>';
            }

            // Modelos e pesos
            if (data.modelos_usados) {
                html += '<h4 style="color:#f39c12;margin-top:16px;">Modelos e Pesos</h4>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
                var pesos = data.pesos || {};
                for (var mi = 0; mi < data.modelos_usados.length; mi++) {
                    var mod = data.modelos_usados[mi];
                    var peso = pesos[mod] != null ? (pesos[mod] * 100).toFixed(0) + '%' : '?';
                    html += '<span style="background:#16213e;color:#9b59b6;padding:4px 10px;border-radius:12px;font-size:12px;">' + mod + ': ' + peso + '</span>';
                }
                html += '</div>';
            }

            if (statusEl) statusEl.innerHTML = html;
        }).catch(function(err) {
            if (statusEl) statusEl.innerHTML = '<p style="color:#e74c3c;">❌ ' + err.message + '</p>';
        });
    },

    // ==================== PREVISÕES ====================
    gerarPrevisoes: function() {
        var self = this;
        var statusEl = self.el('previsoes-resultado');
        var qtdInput = self.el('previsoes-quantidade');
        var qtd = parseInt((qtdInput ? qtdInput.value : '5'), 10) || 5;
        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">⏳ Gerando previsões com 8 modelos de IA...</p>';

        self.apiRequest('/api/previsoes/gerar', {
            method: 'POST',
            body: JSON.stringify({ jogo_slug: self.currentGame, quantidade_jogos: qtd })
        }).then(function(data) {
            self._lastPrevisoes = data.previsoes || [];
            var cfg = self.jogosConfig[self.currentGame] || {};
            var html = '<h3 style="color:#00d4ff;">Previsões - ' + (cfg.nome || self.currentGame) + '</h3>';
            html += '<p>Concursos analisados: <strong>' + (data.total_concursos_analisados || '?') + '</strong> | Modelos: <strong>' + ((data.modelos_usados || []).length) + '</strong></p>';

            if (self._lastPrevisoes.length === 0) {
                html += '<p style="color:#f39c12;">Nenhuma previsão gerada.</p>';
            } else {
                for (var i = 0; i < self._lastPrevisoes.length; i++) {
                    var p = self._lastPrevisoes[i];
                    var numeros = self.parseArray(p.numeros);
                    var trevos = self.parseArray(p.trevos);
                    var confianca = p.confianca != null ? p.confianca : p.confidence;
                    var confiancaPct = confianca != null ? (confianca * 100).toFixed(1) : '?';
                    var color = confianca != null ? self.getScoreColor(confianca) : '#888';

                    html += '<div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:12px;">';
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
                    html += '<span style="color:#00d4ff;font-weight:bold;">Jogo ' + (i + 1) + '</span>';
                    html += '<span style="color:' + color + ';font-weight:bold;font-size:18px;">' + confiancaPct + '%</span>';
                    html += '</div>';
                    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">';
                    for (var j = 0; j < numeros.length; j++) {
                        html += '<span style="background:#16213e;color:#fff;border:1px solid #00d4ff;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:bold;">' + self.pad2(numeros[j]) + '</span>';
                    }
                    for (var t = 0; t < trevos.length; t++) {
                        html += '<span style="background:#f39c12;color:#000;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-weight:bold;">☘' + trevos[t] + '</span>';
                    }
                    html += '</div>';
                    if (p.estrategia) {
                        html += '<div style="color:#888;font-size:11px;">Estratégia: ' + p.estrategia + '</div>';
                    }
                    html += '</div>';
                }
            }
            if (statusEl) statusEl.innerHTML = html;
        }).catch(function(err) {
            if (statusEl) statusEl.innerHTML = '<p style="color:#e74c3c;">❌ ' + err.message + '</p>';
        });
    },

    // ==================== VALIDAÇÃO ====================
    validarJogo: function() {
        var self = this;
        var statusEl = self.el('validacao-resultado');
        var inputEl  = self.el('validacao-numeros');
        var trevosEl = self.el('validacao-trevos');
        var numeros = self.parseArray(inputEl ? inputEl.value : '');
        var trevos  = self.parseArray(trevosEl ? trevosEl.value : '');

        if (numeros.length === 0) {
            self.showNotification('Digite os números para validar!', 'error');
            return;
        }
        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">⏳ Validando jogo...</p>';

        self.apiRequest('/api/validacao/validar-jogo', {
            method: 'POST',
            body: JSON.stringify({ jogo_slug: self.currentGame, numeros: numeros, trevos: trevos })
        }).then(function(data) {
            self._lastValidacao = data;
            var score = data.score_geral != null ? data.score_geral : (data.score || data.confianca || 0);
            var color = self.getScoreColor(score);
            var html = '<h3 style="color:#00d4ff;">Resultado da Validação</h3>';
            html += '<div style="text-align:center;margin:20px 0;">';
            html += '<div style="font-size:48px;font-weight:bold;color:' + color + ';">' + (score * 100).toFixed(1) + '%</div>';
            html += '<div style="color:#888;">Confiança Geral</div>';
            html += '</div>';

            // Números avaliados
            var detalhes = data.numeros_detalhes || data.detalhes || [];
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:16px;">';
            for (var i = 0; i < numeros.length; i++) {
                var nd = null;
                for (var d = 0; d < detalhes.length; d++) {
                    if (detalhes[d].numero === numeros[i]) { nd = detalhes[d]; break; }
                }
                var nScore = nd ? (nd.score || nd.confianca || 0) : 0;
                var nColor = self.getScoreColor(nScore);
                html += '<div style="text-align:center;">';
                html += '<div style="background:#1a1a2e;border:2px solid ' + nColor + ';border-radius:50%;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">';
                html += '<span style="color:#fff;font-weight:bold;">' + self.pad2(numeros[i]) + '</span>';
                html += '</div>';
                html += '<div style="color:' + nColor + ';font-size:10px;margin-top:2px;">' + (nScore * 100).toFixed(0) + '%</div>';
                html += '</div>';
            }
            html += '</div>';

            if (data.classificacao) {
                html += '<p style="text-align:center;font-size:16px;">' + self.getClassificacaoLabel(data.classificacao) + '</p>';
            }

            // Scores por modelo
            var sm = data.scores_modelos || data.modelos || {};
            var smKeys = Object.keys(sm);
            if (smKeys.length > 0) {
                var modelosNomes = {
                    frequencia: 'Frequência', atraso: 'Atraso', padrao: 'Padrões',
                    distribuicao: 'Distribuição', lstm: 'LSTM', xgboost: 'XGBoost',
                    monte_carlo: 'Monte Carlo', bayesiano: 'Bayesiano'
                };
                html += '<h4 style="color:#f39c12;margin-top:16px;">Scores por Modelo</h4>';
                html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">';
                for (var s = 0; s < smKeys.length; s++) {
                    var mk = smKeys[s];
                    var mv = sm[mk];
                    var mc = self.getScoreColor(mv);
                    html += '<div style="background:#1a1a2e;padding:8px;border-radius:8px;border-left:3px solid ' + mc + ';">';
                    html += '<div style="color:#888;font-size:11px;">' + (modelosNomes[mk] || mk) + '</div>';
                    html += '<div style="color:' + mc + ';font-weight:bold;">' + (mv * 100).toFixed(1) + '%</div>';
                    html += '</div>';
                }
                html += '</div>';
            }

            if (statusEl) statusEl.innerHTML = html;
        }).catch(function(err) {
            if (statusEl) statusEl.innerHTML = '<p style="color:#e74c3c;">❌ ' + err.message + '</p>';
        });
    },

    // ==================== FECHAMENTO ====================
    gerarFechamento: function() {
        var self = this;
        var statusEl   = self.el('fechamento-resultado');
        var garantiaEl = self.el('fechamento-garantia');
        var universoEl = self.el('fechamento-universo');
        var garantia = garantiaEl ? garantiaEl.value : 'quadra';
        var universo = parseInt(universoEl ? universoEl.value : '15', 10) || 15;

        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">⏳ Gerando fechamento...</p>';

        self.apiRequest('/api/previsoes/fechamento?jogo_slug=' + self.currentGame + '&garantia=' + garantia + '&tamanho_universo=' + universo, {
            method: 'POST'
        }).then(function(data) {
            self._lastFechamento = data.jogos || [];
            var cfg = self.jogosConfig[self.currentGame] || {};
            var html = '<h3 style="color:#00d4ff;">Fechamento - ' + (cfg.nome || self.currentGame) + '</h3>';
            html += '<p>Garantia: <strong>' + (data.garantia || garantia) + '</strong> | Universo: <strong>' + (data.tamanho_universo || universo) + '</strong> | Total: <strong>' + (data.total_jogos || self._lastFechamento.length) + ' jogos</strong></p>';

            if (data.universo && data.universo.length > 0) {
                html += '<h4 style="color:#f39c12;">Universo de Números</h4>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">';
                for (var u = 0; u < data.universo.length; u++) {
                    html += '<span style="background:#16213e;color:#00d4ff;border:1px solid #00d4ff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;">' + self.pad2(data.universo[u]) + '</span>';
                }
                html += '</div>';
            }

            if (data.cobertura != null) {
                var cobText = typeof data.cobertura === 'number' ? (data.cobertura * 100).toFixed(1) + '%' : String(data.cobertura);
                html += '<p>Cobertura: <strong style="color:#27ae60;">' + cobText + '</strong></p>';
            }

            if (self._lastFechamento.length > 0) {
                html += '<h4 style="color:#f39c12;">Jogos Gerados</h4>';
                for (var f = 0; f < self._lastFechamento.length; f++) {
                    var j = self._lastFechamento[f];
                    var nums = self.parseArray(j.numeros);
                    var jScore = j.score || j.confianca || 0;
                    var jColor = self.getScoreColor(jScore);
                    html += '<div style="background:#1a1a2e;border:1px solid #333;border-radius:8px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
                    html += '<span style="color:#888;min-width:55px;">Jogo ' + (f + 1) + '</span>';
                    for (var fn = 0; fn < nums.length; fn++) {
                        html += '<span style="background:#16213e;color:#fff;border:1px solid ' + jColor + ';border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">' + self.pad2(nums[fn]) + '</span>';
                    }
                    html += '<span style="color:' + jColor + ';font-weight:bold;margin-left:auto;">' + (jScore * 100).toFixed(1) + '%</span>';
                    html += '</div>';
                }
            } else {
                html += '<p style="color:#f39c12;">Nenhum jogo gerado.</p>';
            }
            if (statusEl) statusEl.innerHTML = html;
        }).catch(function(err) {
            if (statusEl) statusEl.innerHTML = '<p style="color:#e74c3c;">❌ ' + err.message + '</p>';
        });
    },

    // ==================== BACKTESTING ====================
    executarBacktest: function() {
        var self = this;
        var statusEl    = self.el('backtest-resultado');
        var concursosEl = self.el('backtest-concursos');
        var cartelasEl  = self.el('backtest-cartelas');
        var concursos = parseInt(concursosEl ? concursosEl.value : '50', 10) || 50;
        var cartelas  = parseInt(cartelasEl ? cartelasEl.value : '3', 10) || 3;

        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">⏳ Executando backtesting... Pode levar alguns segundos.</p>';

        self.apiRequest('/api/backtesting/executar', {
            method: 'POST',
            body: JSON.stringify({ jogo_slug: self.currentGame, concursos_teste: concursos, cartelas_por_concurso: cartelas })
        }).then(function(data) {
            var html = '<h3 style="color:#00d4ff;">Backtesting - ' + (self.jogosConfig[self.currentGame] || {}).nome + '</h3>';
            html += '<p>Concursos testados: <strong>' + (data.concursos_testados || concursos) + '</strong></p>';

            var resumo = data.resultados_resumo || data.resumo || {};
            var rKeys = Object.keys(resumo);
            if (rKeys.length > 0) {
                html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0;">';
                for (var r = 0; r < rKeys.length; r++) {
                    var rv = resumo[rKeys[r]];
                    html += '<div style="background:#1a1a2e;padding:12px;border-radius:8px;border:1px solid #333;">';
                    html += '<div style="color:#888;font-size:12px;">' + rKeys[r] + '</div>';
                    html += '<div style="color:#00d4ff;font-size:20px;font-weight:bold;">' + (typeof rv === 'number' ? rv.toFixed(2) : rv) + '</div>';
                    html += '</div>';
                }
                html += '</div>';
            }

            var dist = data.acertos_distribuicao || data.distribuicao || {};
            var dKeys = Object.keys(dist);
            if (dKeys.length > 0) {
                html += '<h4 style="color:#f39c12;">Distribuição de Acertos</h4>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
                for (var di = 0; di < dKeys.length; di++) {
                    html += '<div style="background:#16213e;padding:8px 16px;border-radius:8px;text-align:center;">';
                    html += '<div style="color:#00d4ff;font-size:18px;font-weight:bold;">' + dist[dKeys[di]] + '</div>';
                    html += '<div style="color:#888;font-size:11px;">' + dKeys[di] + ' acertos</div>';
                    html += '</div>';
                }
                html += '</div>';
            }
            if (statusEl) statusEl.innerHTML = html;
        }).catch(function(err) {
            if (statusEl) statusEl.innerHTML = '<p style="color:#e74c3c;">❌ ' + err.message + '</p>';
        });
    },

    // ==================== IMPORTAÇÃO INTELIGENTE ====================
    importarUmJogo: function(jogo, statusEl, prevHtml) {
        var self = this;
        var cfg = self.jogosConfig[jogo];
        if (!cfg) return Promise.resolve({ html: prevHtml || '', inseridos: 0 });

        var apiNome = cfg.apiNome;
        var caixaBase = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';
        var html = prevHtml || '';
        var inseridos = 0;
        var erros = 0;

        function update(s) { if (statusEl) statusEl.innerHTML = s; }

        return self.getUltimoConcursoSalvo(jogo).then(function(salvo) {
            var ultimoSalvo = salvo.concurso;
            var totalSalvo = salvo.total;

            return self.getUltimoConcursoCaixa(apiNome).then(function(ultimoCaixa) {
                if (!ultimoCaixa) {
                    html += '<p style="color:#f39c12;">⚠️ ' + cfg.nome + ': API da Caixa indisponível</p>';
                    update(html);
                    return { html: html, inseridos: 0 };
                }
                if (ultimoSalvo && ultimoSalvo >= ultimoCaixa) {
                    html += '<p style="color:#27ae60;">✅ ' + cfg.nome + ': já atualizado (' + totalSalvo + ' concursos, último #' + ultimoSalvo + ')</p>';
                    update(html);
                    return { html: html, inseridos: 0 };
                }

                var concursoInicial = ultimoSalvo > 0 ? ultimoSalvo + 1 : 1;
                var totalParaImportar = ultimoCaixa - concursoInicial + 1;
                html += '<p style="color:#00d4ff;">⏳ ' + cfg.nome + ': importando ' + totalParaImportar + ' concursos (#' + concursoInicial + ' a #' + ultimoCaixa + ')...</p>';
                update(html);

                var BATCH_SIZE = 30;
                var queue = [];
                for (var start = concursoInicial; start <= ultimoCaixa; start += BATCH_SIZE) {
                    queue.push({ start: start, end: Math.min(start + BATCH_SIZE - 1, ultimoCaixa) });
                }

                var imported = 0;
                function processQueue(idx) {
                    if (idx >= queue.length) {
                        // Finalizado
                        var finalHtml = (prevHtml || '') + '<p style="color:#27ae60;">✅ ' + cfg.nome + ': ' + inseridos + ' novos concursos importados' + (erros > 0 ? ' (' + erros + ' erros)' : '') + '</p>';
                        update(finalHtml);
                        return Promise.resolve({ html: finalHtml, inseridos: inseridos });
                    }

                    var batch = queue[idx];
                    var fetches = [];
                    for (var c = batch.start; c <= batch.end; c++) {
                        fetches.push(
                            (function(num) {
                                return fetch(caixaBase + '/' + apiNome + '/' + num).then(function(resp) {
                                    if (!resp.ok) { erros++; return null; }
                                    return resp.json();
                                }).catch(function() { erros++; return null; });
                            })(c)
                        );
                    }

                    return Promise.all(fetches).then(function(results) {
                        var batchData = [];
                        for (var r = 0; r < results.length; r++) {
                            var d = results[r];
                            if (!d) continue;
                            var numeros = (d.listaDezenas || d.dezenasSorteadasOrdemSorteio || []).map(function(x) { return parseInt(x, 10); });
                            var trevos = (d.trevosSorteados || d.listaTrevos || []).map(function(x) { return parseInt(x, 10); });
                            var premio = 0;
                            if (d.listaRateioPremio && d.listaRateioPremio[0]) {
                                premio = d.listaRateioPremio[0].valorPremio || 0;
                            }
                            if (numeros.length > 0) {
                                batchData.push({
                                    jogo_slug: jogo,
                                    concurso: d.numero || (batch.start + r),
                                    data_sorteio: d.dataApuracao || '',
                                    numeros: numeros,
                                    trevos: trevos,
                                    premio_principal: premio,
                                    acumulou: d.acumulado || false
                                });
                            }
                        }

                        if (batchData.length === 0) {
                            imported += (batch.end - batch.start + 1);
                            return processQueue(idx + 1);
                        }

                        return self.apiRequest('/api/importar-proxy', {
                            method: 'POST',
                            body: JSON.stringify({ jogo_slug: jogo, resultados: batchData })
                        }).then(function(res) {
                            inseridos += res.inseridos || batchData.length;
                            erros += res.erros || 0;
                        }).catch(function() {
                            erros += batchData.length;
                        }).then(function() {
                            imported += (batch.end - batch.start + 1);
                            var pct = Math.min(100, (imported / totalParaImportar * 100)).toFixed(0);
                            var progressHtml = (prevHtml || '') + '<p style="color:#00d4ff;">⏳ ' + cfg.nome + ': ' + pct + '% (' + imported + '/' + totalParaImportar + ')</p>';
                            update(progressHtml);
                            return new Promise(function(resolve) { setTimeout(resolve, 80); });
                        }).then(function() {
                            return processQueue(idx + 1);
                        });
                    });
                }

                return processQueue(0);
            });
        }).catch(function(err) {
            html += '<p style="color:#e74c3c;">❌ ' + cfg.nome + ': ' + err.message + '</p>';
            update(html);
            return { html: html, inseridos: 0 };
        });
    },

    importarHistoricoProxy: function() {
        var self = this;
        var statusEl = self.el('importar-status') || self.el('dashboard-status');
        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">⏳ Verificando dados no Supabase...</p>';

        var jogos = ['mega-sena', 'lotofacil', 'lotomania', 'mais-milionaria'];
        var totalInseridos = 0;

        function processJogo(idx, prevHtml) {
            if (idx >= jogos.length) {
                var finalMsg = totalInseridos === 0
                    ? '<p style="color:#27ae60;font-weight:bold;margin-top:12px;">🎉 Todos os jogos já estão atualizados no Supabase!</p>'
                    : '<p style="color:#27ae60;font-weight:bold;margin-top:12px;">🎉 Importação concluída: ' + totalInseridos + ' novos concursos!</p>';
                var finalHtml = prevHtml + finalMsg;
                if (statusEl) statusEl.innerHTML = finalHtml;
                self.showNotification(totalInseridos > 0 ? totalInseridos + ' novos concursos importados!' : 'Tudo atualizado!', 'success');
                return;
            }
            self.importarUmJogo(jogos[idx], statusEl, prevHtml).then(function(result) {
                totalInseridos += result.inseridos;
                processJogo(idx + 1, result.html);
            });
        }

        processJogo(0, '');
    },

    importarJogoIndividual: function() {
        var self = this;
        var statusEl = self.el('importar-status') || self.el('dashboard-status');
        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">⏳ Verificando...</p>';
        self.importarUmJogo(self.currentGame, statusEl, '').then(function() {
            self.showNotification('Verificação concluída!', 'success');
        });
    },

    forcarAtualizacao: function() {
        var self = this;
        var statusEl = self.el('dashboard-status');
        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">⏳ Verificando atualizações...</p>';

        var jogos = ['mega-sena', 'lotofacil', 'lotomania', 'mais-milionaria'];
        var totalInseridos = 0;

        function processJogo(idx, prevHtml) {
            if (idx >= jogos.length) {
                if (statusEl) statusEl.innerHTML = prevHtml;
                self.showNotification(totalInseridos > 0 ? totalInseridos + ' novos concursos!' : 'Tudo atualizado!', 'success');
                self.loadDashboard();
                return;
            }
            self.importarUmJogo(jogos[idx], statusEl, prevHtml).then(function(result) {
                totalInseridos += result.inseridos;
                processJogo(idx + 1, result.html);
            });
        }

        processJogo(0, '');
    },

    // ==================== ALERTAS ====================
    verificarAlertas: function() {
        var self = this;
        var statusEl = self.el('alertas-resultado');
        if (statusEl) statusEl.innerHTML = '<p style="color:#00d4ff;">⏳ Verificando alertas...</p>';

        self.apiRequest('/api/alertas/verificar?jogo_slug=' + self.currentGame, { method: 'POST' }).then(function() {
            return self.apiRequest('/api/alertas/?jogo_slug=' + self.currentGame + '&apenas_nao_lidos=true');
        }).then(function(data) {
            var alertas = data.alertas || (Array.isArray(data) ? data : []);
            var html = '<h3 style="color:#00d4ff;">Alertas</h3>';
            if (alertas.length === 0) {
                html += '<p style="color:#27ae60;">✅ Nenhum alerta pendente.</p>';
            } else {
                for (var a = 0; a < alertas.length; a++) {
                    var al = alertas[a];
                    var typeColor = al.tipo === 'urgente' ? '#e74c3c' : (al.tipo === 'aviso' ? '#f39c12' : '#00d4ff');
                    html += '<div style="background:#1a1a2e;border-left:3px solid ' + typeColor + ';padding:12px;border-radius:8px;margin-bottom:8px;">';
                    html += '<div style="color:' + typeColor + ';font-weight:bold;">' + (al.titulo || al.tipo || 'Alerta') + '</div>';
                    html += '<div style="color:#ccc;font-size:13px;">' + (al.mensagem || al.descricao || '') + '</div>';
                    html += '</div>';
                }
            }
            if (statusEl) statusEl.innerHTML = html;
        }).catch(function(err) {
            if (statusEl) statusEl.innerHTML = '<p style="color:#e74c3c;">❌ ' + err.message + '</p>';
        });
    },

    // ==================== RETREINAR ====================
    retreinarModelos: function() {
        var self = this;
        self.showNotification('Retreinando modelos...', 'info');
        self.apiRequest('/api/analises/retreinar?jogo_slug=' + self.currentGame, { method: 'POST' }).then(function(data) {
            self.showNotification(data.message || data.mensagem || 'Modelos retreinados!', 'success');
        }).catch(function(err) {
            self.showNotification('Erro: ' + err.message, 'error');
        });
    },

    // ==================== MEUS JOGOS ====================
    setupMeusJogos: function() {
        var self = this;
        var tipoSel = self.el('meus-jogos-tipo');
        if (tipoSel) {
            tipoSel.addEventListener('change', function() { self.atualizarModalPorTipo(); });
            self.atualizarModalPorTipo();
        }
    },

    atualizarModalPorTipo: function() {
        var self = this;
        var tipoSel  = self.el('meus-jogos-tipo');
        var labelEl  = self.el('meus-jogos-numeros-label');
        var inputEl  = self.el('meus-jogos-numeros');
        var trevosGr = self.el('meus-jogos-trevos-group');
        if (!tipoSel) return;
        var jogo = tipoSel.value;
        var cfg = self.jogosConfig[jogo];
        if (!cfg) return;

        var minEsc = cfg.escolhaMin || cfg.escolha;
        var maxEsc = cfg.escolhaMax || cfg.escolha;
        var rangeText = minEsc === maxEsc ? minEsc + ' números' : minEsc + ' a ' + maxEsc + ' números';

        if (labelEl) labelEl.textContent = 'Números (' + rangeText + ' de ' + self.pad2(cfg.min) + ' a ' + self.pad2(cfg.max) + '):';
        if (inputEl) inputEl.placeholder = 'Ex: ' + cfg.min + ', ' + (cfg.min + 1) + ', ' + (cfg.min + 5) + '... (' + rangeText + ')';
        if (trevosGr) trevosGr.style.display = cfg.trevos ? 'block' : 'none';
    },

    validarNumerosJogo: function(numeros, jogo) {
        var cfg = this.jogosConfig[jogo];
        if (!cfg) return { valido: false, erro: 'Jogo não suportado' };

        var minEsc = cfg.escolhaMin || cfg.escolha;
        var maxEsc = cfg.escolhaMax || cfg.escolha;

        if (numeros.length < minEsc || numeros.length > maxEsc) {
            var rangeText = minEsc === maxEsc ? 'exatamente ' + minEsc : 'de ' + minEsc + ' a ' + maxEsc;
            return { valido: false, erro: cfg.nome + ' precisa de ' + rangeText + ' números. Você informou ' + numeros.length + '.' };
        }
        var fora = numeros.filter(function(n) { return n < cfg.min || n > cfg.max; });
        if (fora.length > 0) {
            return { valido: false, erro: 'Números fora do intervalo (' + cfg.min + '-' + cfg.max + '): ' + fora.join(', ') };
        }
        var unicos = {};
        var dups = false;
        for (var i = 0; i < numeros.length; i++) {
            if (unicos[numeros[i]]) { dups = true; break; }
            unicos[numeros[i]] = true;
        }
        if (dups) return { valido: false, erro: 'Há números duplicados.' };
        return { valido: true };
    },

    salvarJogoManual: function() {
        var self = this;
        var tipoSel  = self.el('meus-jogos-tipo');
        var inputEl  = self.el('meus-jogos-numeros');
        var trevosEl = self.el('meus-jogos-trevos');
        var nomeEl   = self.el('meus-jogos-nome');
        var jogo = tipoSel ? tipoSel.value : self.currentGame;
        var numeros = self.parseArray(inputEl ? inputEl.value : '');
        var trevos = self.parseArray(trevosEl ? trevosEl.value : '');
        var nome = (nomeEl ? nomeEl.value : '').trim();

        var val = self.validarNumerosJogo(numeros, jogo);
        if (!val.valido) {
            self.showNotification(val.erro, 'error');
            return;
        }

        var cfg = self.jogosConfig[jogo];
        if (cfg && cfg.trevos && trevos.length !== (cfg.trevosEscolha || 2)) {
            self.showNotification(cfg.nome + ' precisa de ' + (cfg.trevosEscolha || 2) + ' trevos.', 'error');
            return;
        }

        var jogos = self.getMeusJogos();
        jogos.push({
            id: self.gerarId(),
            jogo_slug: jogo,
            nome: nome || 'Jogo Manual ' + (jogos.length + 1),
            numeros: numeros.sort(function(a, b) { return a - b; }),
            trevos: trevos.sort(function(a, b) { return a - b; }),
            fonte: 'manual',
            data: new Date().toISOString(),
            confianca: null
        });
        self.salvarMeusJogos(jogos);
        self.showNotification('Jogo salvo com sucesso!', 'success');
        if (inputEl) inputEl.value = '';
        if (trevosEl) trevosEl.value = '';
        if (nomeEl) nomeEl.value = '';
        self.renderMeusJogos();
    },

    importarPrevisaoParaMeusJogos: function() {
        var self = this;
        if (!self._lastPrevisoes || self._lastPrevisoes.length === 0) {
            self.showNotification('Gere previsões primeiro na aba Previsões!', 'error');
            return;
        }
        var jogos = self.getMeusJogos();
        for (var i = 0; i < self._lastPrevisoes.length; i++) {
            var p = self._lastPrevisoes[i];
            var numeros = self.parseArray(p.numeros);
            var trevos = self.parseArray(p.trevos);
            var confianca = p.confianca != null ? p.confianca : (p.confidence || null);
            jogos.push({
                id: self.gerarId(),
                jogo_slug: self.currentGame,
                nome: 'Previsão ' + (i + 1) + ' - ' + ((self.jogosConfig[self.currentGame] || {}).nome || self.currentGame),
                numeros: numeros.sort(function(a, b) { return a - b; }),
                trevos: trevos.sort(function(a, b) { return a - b; }),
                fonte: 'previsao',
                data: new Date().toISOString(),
                confianca: confianca,
                estrategia: p.estrategia || null
            });
        }
        self.salvarMeusJogos(jogos);
        self.showNotification(self._lastPrevisoes.length + ' previsões importadas!', 'success');
        self.renderMeusJogos();
    },

    importarFechamentoParaMeusJogos: function() {
        var self = this;
        if (!self._lastFechamento || self._lastFechamento.length === 0) {
            self.showNotification('Gere um fechamento primeiro!', 'error');
            return;
        }
        var jogos = self.getMeusJogos();
        for (var i = 0; i < self._lastFechamento.length; i++) {
            var j = self._lastFechamento[i];
            var numeros = self.parseArray(j.numeros);
            jogos.push({
                id: self.gerarId(),
                jogo_slug: self.currentGame,
                nome: 'Fechamento ' + (i + 1) + ' - ' + ((self.jogosConfig[self.currentGame] || {}).nome || self.currentGame),
                numeros: numeros.sort(function(a, b) { return a - b; }),
                trevos: [],
                fonte: 'fechamento',
                data: new Date().toISOString(),
                confianca: j.score || j.confianca || null
            });
        }
        self.salvarMeusJogos(jogos);
        self.showNotification(self._lastFechamento.length + ' jogos importados do fechamento!', 'success');
        self.renderMeusJogos();
    },

    removerMeuJogo: function(id) {
        var jogos = this.getMeusJogos().filter(function(j) { return j.id !== id; });
        this.salvarMeusJogos(jogos);
        this.showNotification('Jogo removido.', 'info');
        this.renderMeusJogos();
    },

    limparMeusJogos: function() {
        if (!confirm('Tem certeza que deseja remover TODOS os seus jogos salvos?')) return;
        this.salvarMeusJogos([]);
        this.showNotification('Todos os jogos removidos.', 'info');
        this.renderMeusJogos();
    },

    validarMeuJogo: function(id) {
        var self = this;
        var jogos = self.getMeusJogos();
        var jogo = null;
        var jogoIdx = -1;
        for (var i = 0; i < jogos.length; i++) {
            if (jogos[i].id === id) { jogo = jogos[i]; jogoIdx = i; break; }
        }
        if (!jogo) return;

        self.showNotification('Validando jogo...', 'info');

        self.apiRequest('/api/validacao/validar-jogo', {
            method: 'POST',
            body: JSON.stringify({ jogo_slug: jogo.jogo_slug, numeros: jogo.numeros, trevos: jogo.trevos || [] })
        }).then(function(data) {
            var score = data.score_geral != null ? data.score_geral : (data.score || data.confianca || 0);
            jogos[jogoIdx].confianca = score;
            jogos[jogoIdx].scores_modelos = data.scores_modelos || data.modelos || null;
            jogos[jogoIdx].classificacao = data.classificacao || null;
            jogos[jogoIdx].validado_em = new Date().toISOString();
            self.salvarMeusJogos(jogos);
            self.showNotification('Confiança: ' + (score * 100).toFixed(1) + '%', 'success');
            self.renderMeusJogos();
        }).catch(function(err) {
            self.showNotification('Erro ao validar: ' + err.message, 'error');
        });
    },

    renderMeusJogos: function() {
        var self = this;
        var container = self.el('meus-jogos-lista');
        if (!container) return;
        var jogos = self.getMeusJogos();

        if (jogos.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">' +
                '<p style="font-size:48px;">🎰</p>' +
                '<p>Nenhum jogo salvo ainda.</p>' +
                '<p style="font-size:13px;">Use o formulário acima para adicionar jogos ou importe da aba Previsões/Fechamento.</p>' +
                '</div>';
            return;
        }

        var fonteLabel = { manual: '✏️ Manual', previsao: '🤖 Previsão IA', fechamento: '🔒 Fechamento' };
        var modelosNomes = {
            frequencia: 'Freq', atraso: 'Atr', padrao: 'Pad', distribuicao: 'Dist',
            lstm: 'LSTM', xgboost: 'XGB', monte_carlo: 'MC', bayesiano: 'Bay'
        };

        var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
        html += '<span style="color:#888;">' + jogos.length + ' jogo(s) salvo(s)</span>';
        html += '<button onclick="App.limparMeusJogos()" style="background:#e74c3c;color:#fff;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:12px;">🗑 Limpar Todos</button>';
        html += '</div>';

        // Mostrar do mais recente para o mais antigo
        for (var idx = jogos.length - 1; idx >= 0; idx--) {
            var j = jogos[idx];
            var cfg = self.jogosConfig[j.jogo_slug] || {};
            var numeros = self.parseArray(j.numeros);
            var trevos = self.parseArray(j.trevos);
            var confianca = j.confianca;
            var confiancaText = confianca != null ? (confianca * 100).toFixed(1) + '%' : 'Não validado';
            var confiancaColor = confianca != null ? self.getScoreColor(confianca) : '#888';

            html += '<div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:12px;">';

            // Header
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">';
            html += '<div>';
            html += '<span style="color:#00d4ff;font-weight:bold;">' + (j.nome || 'Jogo') + '</span>';
            html += '<span style="color:#888;font-size:12px;margin-left:8px;">' + (cfg.nome || j.jogo_slug) + '</span>';
            html += '<span style="color:#666;font-size:11px;margin-left:8px;">' + (fonteLabel[j.fonte] || j.fonte || '') + '</span>';
            html += '</div>';
            html += '<div style="display:flex;gap:6px;">';
            html += '<button onclick="App.validarMeuJogo(\'' + j.id + '\')" style="background:#16213e;color:#00d4ff;border:1px solid #00d4ff;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">🔍 Validar</button>';
            html += '<button onclick="App.removerMeuJogo(\'' + j.id + '\')" style="background:#16213e;color:#e74c3c;border:1px solid #e74c3c;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">🗑</button>';
            html += '</div>';
            html += '</div>';

            // Numbers
            html += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">';
            for (var ni = 0; ni < numeros.length; ni++) {
                html += '<span style="background:#16213e;color:#fff;border:1px solid #444;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">' + self.pad2(numeros[ni]) + '</span>';
            }
            for (var ti = 0; ti < trevos.length; ti++) {
                html += '<span style="background:#f39c12;color:#000;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">☘' + trevos[ti] + '</span>';
            }
            html += '</div>';

            // Confidence
            html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">';
            html += '<span style="color:' + confiancaColor + ';font-weight:bold;font-size:16px;">Confiança: ' + confiancaText + '</span>';
            if (j.estrategia) html += '<span style="color:#888;font-size:11px;">Estratégia: ' + j.estrategia + '</span>';
            if (j.validado_em) html += '<span style="color:#666;font-size:11px;">Validado: ' + new Date(j.validado_em).toLocaleString('pt-BR') + '</span>';
            html += '</div>';

            // Scores por modelo
            if (j.scores_modelos) {
                var smKeys = Object.keys(j.scores_modelos);
                html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">';
                for (var si = 0; si < smKeys.length; si++) {
                    var sk = smKeys[si];
                    var sv = j.scores_modelos[sk];
                    var sc = self.getScoreColor(sv);
                    html += '<span style="background:#0d1117;color:' + sc + ';padding:2px 8px;border-radius:10px;font-size:10px;">' + (modelosNomes[sk] || sk) + ': ' + (sv * 100).toFixed(0) + '%</span>';
                }
                html += '</div>';
            }

            html += '</div>';
        }

        container.innerHTML = html;
    },

    // ==================== NOTIFICATION ====================
    showNotification: function(msg, type) {
        type = type || 'info';
        var existing = document.querySelector('.lotoquant-notif');
        if (existing) existing.remove();
        var colors = { success: '#27ae60', error: '#e74c3c', info: '#00d4ff', warning: '#f39c12' };
        var div = document.createElement('div');
        div.className = 'lotoquant-notif';
        div.style.cssText = 'position:fixed;top:20px;right:20px;padding:14px 24px;border-radius:10px;color:#fff;font-size:14px;font-family:sans-serif;background:' + (colors[type] || colors.info) + ';z-index:99999;opacity:0;transition:opacity 0.3s;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(function() { div.style.opacity = '1'; }, 10);
        setTimeout(function() {
            div.style.opacity = '0';
            setTimeout(function() { if (div.parentNode) div.remove(); }, 300);
        }, 4000);
    }
};

// ==================== BOOT ====================
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});
