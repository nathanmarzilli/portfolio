/* ============================================================
   PALETTE TAILWIND BRANCHÉE SUR LES TOKENS DE THÈME
   ------------------------------------------------------------
   À charger APRÈS le CDN Tailwind et AVANT tout rendu.
   Toutes les couleurs pointent vers les variables CSS définies
   dans assets/css/theme.css : basculer `data-theme` sur <html>
   suffit alors à repeindre l'ensemble du site.
   ============================================================ */
(function () {
	if (typeof window === 'undefined' || !window.tailwind) return;

	window.tailwind.config = {
		darkMode: 'class',
		theme: {
			extend: {
				fontFamily: {
					sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
					display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif']
				},
				colors: {
						'white': 'rgb(var(--t-white) / <alpha-value>)',
						'black': 'rgb(var(--t-black) / <alpha-value>)',
						dark: { 800: 'rgb(var(--t-dark-800) / <alpha-value>)', 850: 'rgb(var(--t-dark-850) / <alpha-value>)', 900: 'rgb(var(--t-dark-900) / <alpha-value>)', 950: 'rgb(var(--t-dark-950) / <alpha-value>)' },
						slate: { 100: 'rgb(var(--t-slate-100) / <alpha-value>)', 200: 'rgb(var(--t-slate-200) / <alpha-value>)', 300: 'rgb(var(--t-slate-300) / <alpha-value>)', 400: 'rgb(var(--t-slate-400) / <alpha-value>)', 500: 'rgb(var(--t-slate-500) / <alpha-value>)', 600: 'rgb(var(--t-slate-600) / <alpha-value>)', 700: 'rgb(var(--t-slate-700) / <alpha-value>)', 900: 'rgb(var(--t-slate-900) / <alpha-value>)' },
						accent: { 400: 'rgb(var(--t-accent-400) / <alpha-value>)', 500: 'rgb(var(--t-accent-500) / <alpha-value>)' },
						gold: { 400: 'rgb(var(--t-gold-400) / <alpha-value>)', 500: 'rgb(var(--t-gold-500) / <alpha-value>)' },
						amber: { 400: 'rgb(var(--t-amber-400) / <alpha-value>)', 500: 'rgb(var(--t-amber-500) / <alpha-value>)' },
						red: { 200: 'rgb(var(--t-red-200) / <alpha-value>)', 300: 'rgb(var(--t-red-300) / <alpha-value>)', 400: 'rgb(var(--t-red-400) / <alpha-value>)', 500: 'rgb(var(--t-red-500) / <alpha-value>)' },
						orange: { 400: 'rgb(var(--t-orange-400) / <alpha-value>)', 500: 'rgb(var(--t-orange-500) / <alpha-value>)' },
						yellow: { 200: 'rgb(var(--t-yellow-200) / <alpha-value>)', 400: 'rgb(var(--t-yellow-400) / <alpha-value>)', 500: 'rgb(var(--t-yellow-500) / <alpha-value>)' },
						green: { 400: 'rgb(var(--t-green-400) / <alpha-value>)', 500: 'rgb(var(--t-green-500) / <alpha-value>)' },
						emerald: { 50: 'rgb(var(--t-emerald-50) / <alpha-value>)', 100: 'rgb(var(--t-emerald-100) / <alpha-value>)', 200: 'rgb(var(--t-emerald-200) / <alpha-value>)', 300: 'rgb(var(--t-emerald-300) / <alpha-value>)', 400: 'rgb(var(--t-emerald-400) / <alpha-value>)', 500: 'rgb(var(--t-emerald-500) / <alpha-value>)', 950: 'rgb(var(--t-emerald-950) / <alpha-value>)' },
						cyan: { 400: 'rgb(var(--t-cyan-400) / <alpha-value>)', 500: 'rgb(var(--t-cyan-500) / <alpha-value>)' },
						blue: { 200: 'rgb(var(--t-blue-200) / <alpha-value>)', 300: 'rgb(var(--t-blue-300) / <alpha-value>)', 400: 'rgb(var(--t-blue-400) / <alpha-value>)', 500: 'rgb(var(--t-blue-500) / <alpha-value>)', 600: 'rgb(var(--t-blue-600) / <alpha-value>)' },
						indigo: { 300: 'rgb(var(--t-indigo-300) / <alpha-value>)', 400: 'rgb(var(--t-indigo-400) / <alpha-value>)', 500: 'rgb(var(--t-indigo-500) / <alpha-value>)' },
						violet: { 400: 'rgb(var(--t-violet-400) / <alpha-value>)', 500: 'rgb(var(--t-violet-500) / <alpha-value>)' },
						purple: { 400: 'rgb(var(--t-purple-400) / <alpha-value>)', 500: 'rgb(var(--t-purple-500) / <alpha-value>)' },
						pink: { 400: 'rgb(var(--t-pink-400) / <alpha-value>)', 500: 'rgb(var(--t-pink-500) / <alpha-value>)' },
						rose: { 400: 'rgb(var(--t-rose-400) / <alpha-value>)', 500: 'rgb(var(--t-rose-500) / <alpha-value>)' },
				},
				animation: {
					blob: 'blob 7s infinite',
					'pop-in': 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
					'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
					'fade-up': 'fadeUp 0.5s ease-out forwards'
				},
				keyframes: {
					blob: {
						'0%': { transform: 'translate(0px, 0px) scale(1)' },
						'33%': { transform: 'translate(30px, -50px) scale(1.1)' },
						'66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
						'100%': { transform: 'translate(0px, 0px) scale(1)' }
					},
					popIn: {
						'0%': { transform: 'translateX(-10px) scale(0.9)', opacity: 0 },
						'100%': { transform: 'translateX(0) scale(1)', opacity: 1 }
					},
					fadeUp: {
						'0%': { transform: 'translateY(20px)', opacity: 0 },
						'100%': { transform: 'translateY(0)', opacity: 1 }
					}
				}
			}
		}
	};
})();
