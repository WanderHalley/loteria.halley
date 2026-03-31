/**
 * LotoQuant - Utilidades
 */
const Utils = {
    jogosNomes: {
        'mega-sena': 'Mega-Sena',
        'lotofacil': 'Lotofácil',
        'lotomania': 'Lotomania',
        'mais-milionaria': '+Milionária'
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('pt-BR');
    },

    formatMoney(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    },

    getScoreClass(score) {
        if (score >= 70) return 'score-high';
        if (score >= 40) return 'score-mid';
        return 'score-low';
    },

    getBallClass(score, maxScore) {
        const ratio = score / maxScore;
        if (ratio > 0.75) return 'hot';
        if (ratio > 0.5) return 'warm';
        if (ratio > 0.25) return 'neutral';
        return 'cold';
    },

    createBall(numero, extra = '') {
        return `<span class="ball ${extra}">${String(numero).padStart(2, '0')}</span>`;
    },

    showLoading(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
    },

    hideLoading(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    },

    showElement(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
    },

    hideElement(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    },

    showFeedback(containerId, message, type = 'success') {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `<div class="feedback ${type}">${message}</div>`;
        setTimeout(() => { container.innerHTML = ''; }, 5000);
    },

    debounce(fn, ms = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }
};
