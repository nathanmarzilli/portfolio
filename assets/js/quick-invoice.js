/* ============================================================
   FACTURE RAPIDE — aide à domicile (admin uniquement)
   ------------------------------------------------------------
   Utilisée sur /aide-domicile/ (bouton « Facturer » de chaque
   prestation, visible seulement quand Nathan est connecté) et
   dans /admin/ (bouton « Facture rapide »).

   Parcours, en une seule fenêtre :
     1. Nathan choisit la prestation et saisit le client.
     2. Enregistrement de la fiche client (nm_clients, source
        « aide-domicile ») et de la facture (nm_documents) :
        tout apparaît immédiatement dans /admin/.
     3. Création de la facture Stripe en mode « sur place »
        (fonction Edge stripe-invoice v5) : e-mail facultatif.
     4. Affichage d'un QR code : le client le scanne avec SON
        téléphone et paie (carte, Apple Pay, Google Pay). Ou
        Nathan ouvre la page de paiement sur son propre téléphone
        et le client y saisit sa carte.
     5. Suivi automatique : dès que Stripe confirme le paiement,
        la facture et la fiche client passent à « Payée ».

   ⚠️ « Poser son téléphone sur celui de Nathan » (paiement sans
   contact NFC, Tap to Pay) n'est PAS possible depuis une page web :
   Stripe le réserve à son application mobile / son SDK Terminal.
   Voir DOCUMENTATION.md § 24.

   Tous les montants viennent de config.js → facilitateur.
   Aucun window.confirm/alert (règle 9) : tout est dans la fenêtre.
   ============================================================ */
(function (root) {
	'use strict';

	var CFG = root.APP_CONFIG || {};
	var F = CFG.facilitateur || {};
	var QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';

	var state = { pollTimer: null, doc: null, client: null, invoice: null };

	function $(sel, ctx) { return (ctx || document).querySelector(sel); }
	function esc(v) {
		return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}
	function eur(n) {
		return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: (Math.abs(n % 1) > 0.001 ? 2 : 0), maximumFractionDigits: 2 }).format(n || 0);
	}
	function amountOf(service) {
		return CFG.facilitateurAmount ? Number(CFG.facilitateurAmount(service.amount)) || 0 : 0;
	}
	function services() { return (F.services || []); }
	function findService(key) { return services().filter(function (s) { return s.key === key; })[0] || services()[0]; }

	// ------------------------------------------------------------
	// Calcul des lignes (source unique : config.js)
	// ------------------------------------------------------------
	function computeLines(form) {
		var service = findService(form.service);
		var qty = service.quantity ? Math.max(1, parseInt(form.qty, 10) || 1) : 1;
		var unit = amountOf(service);
		var lines = [];

		if (form.noFix) {
			// Déplacement sans solution : gratuit, rien à encaisser.
			return { lines: [{ desc: service.label + ' — aucune solution trouvée : déplacement offert', qty: 1, price: 0 }], total: 0, service: service };
		}

		var label = service.label;
		if (service.key === 'cassetteBundle' && F.cassetteBundle) {
			label = 'Lot de ' + F.cassetteBundle.count + ' cassettes numérisées (' + (CFG.facilitateurText ? CFG.facilitateurText('bundleFree') : 'une cassette offerte') + ')';
		}
		lines.push({ desc: label, qty: qty, price: unit });

		if (form.complex && F.complexSurchargeEur) {
			lines.push({ desc: 'Supplément problème complexe', qty: 1, price: F.complexSurchargeEur });
		}
		if (form.loyalty && F.loyalty) {
			var discount = Math.round(unit * (F.loyalty.discountPercent / 100) * 100) / 100;
			lines.push({
				desc: 'Carte de fidélité : ' + F.loyalty.visits + 'ᵉ intervention (-' + F.loyalty.discountPercent + ' %)',
				qty: 1, price: -discount
			});
		}
		var total = lines.reduce(function (s, l) { return s + l.qty * l.price; }, 0);
		return { lines: lines, total: Math.max(0, Math.round(total * 100) / 100), service: service };
	}

	// Stripe n'accepte pas de ligne négative : la remise fidélité est
	// intégrée au prix de la ligne principale (libellé explicite).
	function stripeItems(lines) {
		var out = [];
		var discount = lines.filter(function (l) { return l.price < 0; }).reduce(function (s, l) { return s + l.price * l.qty; }, 0);
		lines.forEach(function (l, i) {
			if (l.price <= 0) return;
			var price = l.price;
			var desc = l.desc;
			if (i === 0 && discount < 0) {
				price = Math.round((l.price * l.qty + discount) / l.qty * 100) / 100;
				desc += ' — remise fidélité appliquée';
			}
			out.push({ description: desc, quantity: l.qty, amount: price });
		});
		return out.filter(function (x) { return x.amount > 0; });
	}

	// ------------------------------------------------------------
	// Fenêtre
	// ------------------------------------------------------------
	function ensureModal() {
		var modal = $('#qi-modal');
		if (modal) return modal;
		var style = document.createElement('style');
		style.textContent =
			'#qi-modal{border:none;padding:0;background:transparent;max-width:min(620px,96vw);width:100%;}' +
			'#qi-modal::backdrop{background:rgb(2 6 23 / .72);backdrop-filter:blur(6px);}' +
			'#qi-modal .qi-card{border-radius:1.5rem;background:rgb(var(--t-dark-900));border:1px solid rgb(var(--t-hairline) / calc(var(--t-hairline-alpha) * 3));box-shadow:var(--t-elevation);max-height:92vh;overflow:auto;}' +
			'#qi-modal .qi-check{display:flex;gap:.6rem;align-items:flex-start;padding:.6rem .75rem;border-radius:.75rem;border:1px solid rgb(var(--t-hairline) / calc(var(--t-hairline-alpha) * 2.5));cursor:pointer;font-size:.8rem;color:rgb(var(--t-slate-300));}' +
			'#qi-modal .qi-check input{accent-color:rgb(var(--t-accent-400));margin-top:.15rem;}' +
			'#qi-modal .qi-qr{background:#fff;border-radius:1rem;padding:.8rem;display:inline-block;}' +
			'#qi-modal .qi-qr img,#qi-modal .qi-qr canvas{display:block;width:230px;height:230px;image-rendering:pixelated;}';
		document.head.appendChild(style);

		modal = document.createElement('dialog');
		modal.id = 'qi-modal';
		modal.innerHTML =
			'<div class="qi-card p-6 space-y-4">' +
				'<div class="flex items-center justify-between gap-3">' +
					'<h2 class="font-display font-bold text-lg text-white flex items-center gap-2"><i class="ph-bold ph-lightning text-accent-400" aria-hidden="true"></i> Facture rapide</h2>' +
					'<button type="button" class="text-slate-500 hover:text-white" data-qi-close aria-label="Fermer"><i class="ph-bold ph-x text-xl" aria-hidden="true"></i></button>' +
				'</div>' +

				'<form id="qi-form" class="space-y-4">' +
					'<div><label class="label-premium" for="qi-service">Prestation</label><select class="select-premium" id="qi-service"></select></div>' +
					'<div id="qi-qty-row" class="hidden"><label class="label-premium" for="qi-qty">Quantité</label><input type="number" min="1" step="1" value="1" class="input-premium" id="qi-qty"></div>' +
					'<div class="grid sm:grid-cols-2 gap-2">' +
						'<label class="qi-check"><input type="checkbox" id="qi-complex"><span>Problème complexe <strong class="text-white" id="qi-complex-amount"></strong></span></label>' +
						'<label class="qi-check"><input type="checkbox" id="qi-loyalty"><span id="qi-loyalty-label">Carte de fidélité</span></label>' +
						'<label class="qi-check sm:col-span-2"><input type="checkbox" id="qi-nofix"><span>Aucune solution trouvée : <strong class="text-white">déplacement gratuit</strong> (rien à encaisser, la visite est quand même enregistrée)</span></label>' +
					'</div>' +

					'<div class="grid sm:grid-cols-2 gap-3">' +
						'<div><label class="label-premium" for="qi-firstname">Prénom</label><input class="input-premium" id="qi-firstname" autocomplete="off"></div>' +
						'<div><label class="label-premium" for="qi-lastname">Nom</label><input class="input-premium" id="qi-lastname" autocomplete="off"></div>' +
					'</div>' +
					'<div class="grid sm:grid-cols-2 gap-3">' +
						'<div><label class="label-premium" for="qi-phone">Téléphone</label><input class="input-premium" id="qi-phone" inputmode="tel" autocomplete="off"></div>' +
						'<div><label class="label-premium" for="qi-email">E-mail <span class="normal-case font-normal text-slate-500">(facultatif, pour le reçu)</span></label><input type="email" class="input-premium" id="qi-email" autocomplete="off"></div>' +
					'</div>' +
					'<div><label class="label-premium" for="qi-address">Adresse</label><input class="input-premium" id="qi-address" placeholder="Rue, code postal, ville" autocomplete="off"></div>' +
					'<div><label class="label-premium" for="qi-notes">Note interne</label><input class="input-premium" id="qi-notes" placeholder="Ex : box Orange réinitialisée, imprimante réinstallée" autocomplete="off"></div>' +

					'<div class="rounded-2xl border border-slate-500/15 p-4 bg-slate-500/5">' +
						'<div id="qi-lines" class="text-xs text-slate-400 space-y-1"></div>' +
						'<div class="flex items-baseline justify-between mt-3 pt-3 border-t border-slate-500/15">' +
							'<span class="text-xs uppercase tracking-wider font-bold text-slate-400">Total à encaisser</span>' +
							'<span id="qi-total" class="font-display text-3xl font-bold text-accent-400"></span>' +
						'</div>' +
					'</div>' +

					'<p id="qi-error" class="hidden text-xs font-bold text-red-400"></p>' +
					'<div class="flex flex-wrap justify-end gap-2">' +
						'<button type="button" class="btn-ghost" data-qi-close>Annuler</button>' +
						'<button type="submit" class="btn-primary" id="qi-submit"><i class="ph-bold ph-qr-code" aria-hidden="true"></i> Créer la facture et encaisser</button>' +
					'</div>' +
				'</form>' +

				'<div id="qi-pay" class="hidden text-center space-y-4">' +
					'<p class="text-sm text-slate-400" id="qi-pay-intro"></p>' +
					'<div class="font-display text-4xl font-bold text-accent-400" id="qi-pay-amount"></div>' +
					'<div class="qi-qr" id="qi-qr"></div>' +
					'<p class="text-xs text-slate-400 max-w-sm mx-auto">Le client scanne ce code avec l’appareil photo de son téléphone et paie par carte, Apple Pay ou Google Pay. Sinon, ouvrez la page de paiement sur votre téléphone et laissez-le saisir sa carte.</p>' +
					'<div class="flex flex-wrap justify-center gap-2">' +
						'<a class="btn-primary" id="qi-open" href="#" target="_blank" rel="noopener"><i class="ph-bold ph-credit-card" aria-hidden="true"></i> Ouvrir la page de paiement</a>' +
						'<button type="button" class="btn-ghost" id="qi-copy"><i class="ph-bold ph-link" aria-hidden="true"></i> Copier le lien</button>' +
					'</div>' +
					'<div id="qi-status" class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-amber-400/10 text-amber-400 border border-amber-400/30">' +
						'<i class="ph-bold ph-spinner animate-spin" aria-hidden="true"></i> En attente du paiement…' +
					'</div>' +
					'<p class="text-[11px] text-slate-500" id="qi-saved"></p>' +
					'<div><button type="button" class="btn-ghost" data-qi-close>Fermer</button></div>' +
				'</div>' +
			'</div>';
		document.body.appendChild(modal);

		modal.querySelectorAll('[data-qi-close]').forEach(function (b) { b.addEventListener('click', close); });
		modal.addEventListener('close', stopPolling);
		$('#qi-service', modal).innerHTML = services().map(function (s) {
			return '<option value="' + esc(s.key) + '">' + esc(s.label) + ' — ' + esc(eur(amountOf(s))) + (s.quantity ? ' / ' + esc(s.unit) : '') + '</option>';
		}).join('');
		['#qi-service', '#qi-qty', '#qi-complex', '#qi-loyalty', '#qi-nofix'].forEach(function (sel) {
			$(sel, modal).addEventListener('input', refresh);
			$(sel, modal).addEventListener('change', refresh);
		});
		$('#qi-form', modal).addEventListener('submit', submit);
		$('#qi-copy', modal).addEventListener('click', function () {
			var url = $('#qi-open', modal).href;
			if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { $('#qi-copy', modal).innerHTML = '<i class="ph-bold ph-check" aria-hidden="true"></i> Lien copié'; });
		});
		return modal;
	}

	function readForm() {
		var m = $('#qi-modal');
		return {
			service: $('#qi-service', m).value,
			qty: $('#qi-qty', m).value,
			complex: $('#qi-complex', m).checked,
			loyalty: $('#qi-loyalty', m).checked,
			noFix: $('#qi-nofix', m).checked,
			firstName: $('#qi-firstname', m).value.trim(),
			lastName: $('#qi-lastname', m).value.trim(),
			phone: $('#qi-phone', m).value.trim(),
			email: $('#qi-email', m).value.trim(),
			address: $('#qi-address', m).value.trim(),
			notes: $('#qi-notes', m).value.trim()
		};
	}

	function refresh() {
		var m = $('#qi-modal');
		var form = readForm();
		var service = findService(form.service);
		$('#qi-qty-row', m).classList.toggle('hidden', !service.quantity);
		$('#qi-complex-amount', m).textContent = '+ ' + eur(F.complexSurchargeEur || 0);
		if (F.loyalty) {
			$('#qi-loyalty-label', m).innerHTML = F.loyalty.visits + 'ᵉ intervention (carte de fidélité) : <strong class="text-white">-' + F.loyalty.discountPercent + ' %</strong>';
		}
		['#qi-complex', '#qi-loyalty'].forEach(function (sel) { $(sel, m).disabled = form.noFix; });
		var calc = computeLines(form);
		$('#qi-lines', m).innerHTML = calc.lines.map(function (l) {
			return '<div class="flex justify-between gap-3"><span>' + esc(l.desc) + (l.qty > 1 ? ' × ' + l.qty : '') + '</span><span class="whitespace-nowrap ' + (l.price < 0 ? 'text-emerald-400' : 'text-slate-300') + '">' + esc(eur(l.qty * l.price)) + '</span></div>';
		}).join('');
		$('#qi-total', m).textContent = eur(calc.total);
		$('#qi-submit', m).innerHTML = calc.total > 0
			? '<i class="ph-bold ph-qr-code" aria-hidden="true"></i> Créer la facture et encaisser'
			: '<i class="ph-bold ph-floppy-disk" aria-hidden="true"></i> Enregistrer la visite (gratuite)';
	}

	function showError(msg) {
		var el = $('#qi-error');
		el.textContent = msg;
		el.classList.toggle('hidden', !msg);
	}

	function open(options) {
		var m = ensureModal();
		var opts = options || {};
		$('#qi-form', m).reset();
		$('#qi-form', m).classList.remove('hidden');
		$('#qi-pay', m).classList.add('hidden');
		showError('');
		if (opts.service) $('#qi-service', m).value = opts.service;
		refresh();
		if (typeof m.showModal === 'function') m.showModal(); else m.setAttribute('open', '');
		setTimeout(function () { $('#qi-firstname', m).focus(); }, 50);
	}

	function close() {
		var m = $('#qi-modal');
		stopPolling();
		if (!m) return;
		if (typeof m.close === 'function' && m.open) m.close(); else m.removeAttribute('open');
		if (typeof state.onDone === 'function' && state.doc) state.onDone(state.doc);
	}

	function stopPolling() {
		if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
	}

	function loadQrLib() {
		if (root.qrcode) return Promise.resolve(root.qrcode);
		return new Promise(function (resolve, reject) {
			var s = document.createElement('script');
			s.src = QR_LIB;
			s.onload = function () { resolve(root.qrcode); };
			s.onerror = reject;
			document.head.appendChild(s);
		});
	}

	function drawQr(url) {
		var host = $('#qi-qr');
		host.innerHTML = '<p class="text-xs text-slate-600 p-6">Génération du QR code…</p>';
		loadQrLib().then(function (qrcode) {
			var qr = qrcode(0, 'M');
			qr.addData(url);
			qr.make();
			host.innerHTML = qr.createImgTag(6, 8, 'QR code de paiement');
		}).catch(function () {
			host.innerHTML = '<p class="text-xs text-slate-600 p-6">QR code indisponible : utilisez « Ouvrir la page de paiement ».</p>';
		});
	}

	async function submit(e) {
		e.preventDefault();
		showError('');
		var form = readForm();
		if (!form.firstName && !form.lastName) { showError('Indiquez au moins le nom du client.'); return; }
		if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) { showError('E-mail invalide.'); return; }

		var calc = computeLines(form);
		var btn = $('#qi-submit');
		btn.disabled = true;
		btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin" aria-hidden="true"></i> Enregistrement…';

		var db;
		try { db = await root.NM.dbReady; } catch (err) { showError('Base de données injoignable.'); btn.disabled = false; refresh(); return; }

		var fullName = (form.firstName + ' ' + form.lastName).trim();
		var city = (form.address.match(/\d{5}\s+(.+)$/) || [])[1] || null;

		try {
			// 1. Fiche client — colonnes existantes de nm_clients uniquement (règle 8).
			var client = await db.saveClient({
				first_name: form.firstName || null,
				last_name: form.lastName || null,
				email: form.email || null,
				phone: form.phone || null,
				address: form.address || null,
				city: city,
				pack: 'aide-domicile',
				pack_label: calc.service.label,
				pack_price: calc.total,
				currency: 'EUR',
				options: [],
				options_total: 0,
				total_one_time: calc.total,
				status: 'livre',
				quote_status: 'aucun',
				invoice_status: calc.total > 0 ? 'envoyee' : 'aucune',
				source: 'aide-domicile',
				notes: form.notes || null
			});
			state.client = client;

			// 2. Facture interne (nm_documents)
			var number = await db.nextDocumentNumber('facture');
			var doc = await db.saveDocument({
				kind: 'facture',
				number: number,
				client_id: client.id,
				client_name: fullName,
				client_address: form.address || '',
				client_email: form.email || '',
				issue_date: new Date().toISOString().slice(0, 10),
				items: calc.lines.map(function (l) { return { desc: l.desc, qty: l.qty, price: l.price }; }),
				vat_applied: false,
				total_ht: calc.total,
				total_ttc: calc.total,
				currency: 'EUR',
				status: calc.total > 0 ? 'brouillon' : 'payee',
				paid_at: calc.total > 0 ? null : new Date().toISOString(),
				notes: 'Facture rapide — aide à domicile' + (form.notes ? ' · ' + form.notes : '')
			});
			state.doc = doc;

			if (calc.total <= 0) {
				$('#qi-form').classList.add('hidden');
				$('#qi-pay').classList.remove('hidden');
				$('#qi-pay-intro').textContent = 'Visite enregistrée pour ' + fullName + '.';
				$('#qi-pay-amount').textContent = 'Gratuit';
				$('#qi-qr').classList.add('hidden');
				$('#qi-open').classList.add('hidden');
				$('#qi-copy').classList.add('hidden');
				setStatus('paid', 'Aucun paiement nécessaire');
				$('#qi-saved').textContent = 'Fiche client et facture ' + number + ' enregistrées dans l’espace clients.';
				return;
			}

			// 3. Facture Stripe « sur place »
			btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin" aria-hidden="true"></i> Création chez Stripe…';
			var res = await db.sendStripeInvoice({
				onsite: true,
				customer: { name: fullName, email: form.email || '', phone: form.phone || '' },
				items: stripeItems(calc.lines),
				currency: 'eur',
				dueDays: 1,
				number: number,
				documentId: doc.id,
				memo: 'Facture ' + number + ' — ' + ((CFG.brand && CFG.brand.name) || 'Clic à l’aide') + ' · Nathan Marzilli'
			});
			if (!res || !res.ok) {
				var msg = (res && res.error) || 'erreur inconnue';
				if (res && res.code === 'stripe_not_configured') msg = 'Clé Stripe absente : ajoutez STRIPE_SECRET_KEY dans Supabase → Edge Functions → Secrets.';
				throw new Error('Stripe : ' + msg + ' (fiche client et facture ' + number + ' déjà enregistrées en brouillon).');
			}
			state.invoice = res;
			doc = await db.saveDocument({
				id: doc.id, status: 'envoye', stripe_invoice_id: res.invoiceId,
				stripe_hosted_url: res.hostedUrl, stripe_status: res.status, sent_at: new Date().toISOString()
			});
			state.doc = doc;

			// 4. Écran d'encaissement
			$('#qi-form').classList.add('hidden');
			$('#qi-pay').classList.remove('hidden');
			$('#qi-qr').classList.remove('hidden');
			$('#qi-open').classList.remove('hidden');
			$('#qi-copy').classList.remove('hidden');
			$('#qi-pay-intro').textContent = 'Facture ' + number + ' · ' + fullName + (res.livemode ? '' : ' · mode test Stripe');
			$('#qi-pay-amount').textContent = eur(calc.total);
			$('#qi-open').href = res.hostedUrl;
			$('#qi-saved').textContent = 'Fiche client et facture enregistrées dans l’espace clients' + (res.emailed ? ' · facture envoyée par e-mail.' : '.');
			drawQr(res.hostedUrl);
			setStatus('waiting');
			startPolling(db, res.invoiceId, doc.id, client.id);
		} catch (err) {
			console.error(err);
			showError(err.message || 'Création impossible.');
			btn.disabled = false;
			refresh();
		}
	}

	function setStatus(kind, text) {
		var el = $('#qi-status');
		if (!el) return;
		if (kind === 'paid') {
			el.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/30';
			el.innerHTML = '<i class="ph-fill ph-check-circle" aria-hidden="true"></i> ' + esc(text || 'Paiement reçu, merci !');
		} else {
			el.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-amber-400/10 text-amber-400 border border-amber-400/30';
			el.innerHTML = '<i class="ph-bold ph-spinner animate-spin" aria-hidden="true"></i> ' + esc(text || 'En attente du paiement…');
		}
	}

	function startPolling(db, invoiceId, docId, clientId) {
		stopPolling();
		var tries = 0;
		state.pollTimer = setInterval(async function () {
			tries++;
			if (tries > 150) { stopPolling(); setStatus('waiting', 'Paiement non confirmé — vérifiez plus tard dans l’espace clients'); return; }
			try {
				var st = await db.sendStripeInvoice({ action: 'status', invoiceId: invoiceId });
				if (st && st.ok && st.paid) {
					stopPolling();
					var now = new Date().toISOString();
					await db.saveDocument({ id: docId, status: 'payee', stripe_status: 'paid', paid_at: now });
					await db.saveClient({ id: clientId, invoice_status: 'payee' });
					state.doc = Object.assign({}, state.doc, { status: 'payee', paid_at: now });
					setStatus('paid');
				}
			} catch (err) { /* réseau : on réessaie au tick suivant */ }
		}, 4000);
	}

	root.NM = root.NM || {};
	root.NM.quickInvoice = {
		open: open,
		close: close,
		onDone: function (fn) { state.onDone = fn; },
		// exposé pour les tests
		_computeLines: computeLines,
		_stripeItems: stripeItems
	};
})(window);
