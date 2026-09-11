/* ============================================================
   Confirmation NON native — remplace window.confirm().
   ------------------------------------------------------------
   window.confirm()/alert() bloquent le fil d'exécution et
   affichent une boîte de dialogue du navigateur (icône, style,
   bouton "Empêcher cette page de créer d'autres dialogues…") :
   c'est ce comportement, perçu comme intrusif, qu'on retire ici.

   window.nmConfirm(message, opts) construit à la place une petite
   boîte de dialogue HTML (élément <dialog>, comme les autres
   modales du site) et renvoie une Promise<boolean> — à utiliser
   avec await, exactement comme window.confirm() mais sans jamais
   quitter la page pour un popup système.

   opts (facultatif) : { title, okLabel, cancelLabel, danger }
   ============================================================ */
(function () {
	'use strict';

	var STYLE_ID = 'nm-confirm-style';
	var DIALOG_ID = 'nm-confirm-dialog';

	function ensureStyle() {
		if (document.getElementById(STYLE_ID)) return;
		var css = document.createElement('style');
		css.id = STYLE_ID;
		css.textContent =
			'dialog.nm-confirm-modal{border:none;padding:0;background:transparent;max-width:min(440px,92vw);width:100%;}' +
			'dialog.nm-confirm-modal::backdrop{background:rgb(2 6 23 / .72);backdrop-filter:blur(6px);}' +
			'dialog.nm-confirm-modal .nm-confirm-card{background:#0f172a;border:1px solid rgba(148,163,184,.18);border-radius:1rem;padding:1.4rem 1.5rem;box-shadow:0 20px 45px -10px rgb(0 0 0 / .5);}' +
			'dialog.nm-confirm-modal h2{font-family:inherit;font-weight:700;font-size:1.02rem;margin:0 0 .55rem;color:#fff;}' +
			'dialog.nm-confirm-modal p{white-space:pre-line;font-size:.85rem;line-height:1.55;color:#cbd5e1;margin:0 0 1.25rem;}' +
			'dialog.nm-confirm-modal .nm-confirm-actions{display:flex;justify-content:flex-end;gap:.55rem;flex-wrap:wrap;}' +
			'dialog.nm-confirm-modal button{cursor:pointer;border-radius:.65rem;padding:.55rem 1.1rem;font-size:.8rem;font-weight:700;border:1px solid transparent;font-family:inherit;}' +
			'dialog.nm-confirm-modal .nm-confirm-cancel{background:rgba(148,163,184,.1);color:#e2e8f0;}' +
			'dialog.nm-confirm-modal .nm-confirm-cancel:hover{background:rgba(148,163,184,.2);}' +
			'dialog.nm-confirm-modal .nm-confirm-ok{background:#22c55e;color:#052e16;}' +
			'dialog.nm-confirm-modal .nm-confirm-ok:hover{filter:brightness(1.08);}' +
			'dialog.nm-confirm-modal .nm-confirm-ok.danger{background:#ef4444;color:#450a0a;}';
		document.head.appendChild(css);
	}

	function ensureDialog() {
		var dlg = document.getElementById(DIALOG_ID);
		if (dlg) return dlg;
		ensureStyle();
		dlg = document.createElement('dialog');
		dlg.id = DIALOG_ID;
		dlg.className = 'nm-confirm-modal';
		dlg.innerHTML =
			'<div class="nm-confirm-card">' +
				'<h2 id="nm-confirm-title">Confirmer</h2>' +
				'<p id="nm-confirm-message"></p>' +
				'<div class="nm-confirm-actions">' +
					'<button type="button" id="nm-confirm-cancel" class="nm-confirm-cancel">Annuler</button>' +
					'<button type="button" id="nm-confirm-ok" class="nm-confirm-ok">OK</button>' +
				'</div>' +
			'</div>';
		document.body.appendChild(dlg);
		return dlg;
	}

	window.nmConfirm = function (message, opts) {
		opts = opts || {};
		return new Promise(function (resolve) {
			var dlg = ensureDialog();
			dlg.querySelector('#nm-confirm-title').textContent = opts.title || 'Confirmer';
			dlg.querySelector('#nm-confirm-message').textContent = message || '';

			var okBtn = dlg.querySelector('#nm-confirm-ok');
			var cancelBtn = dlg.querySelector('#nm-confirm-cancel');
			okBtn.textContent = opts.okLabel || 'OK';
			cancelBtn.textContent = opts.cancelLabel || 'Annuler';
			okBtn.className = 'nm-confirm-ok' + (opts.danger ? ' danger' : '');

			var done = false;
			function finish(result) {
				if (done) return;
				done = true;
				okBtn.removeEventListener('click', onOk);
				cancelBtn.removeEventListener('click', onCancel);
				dlg.removeEventListener('cancel', onDlgCancel);
				try { dlg.close(); } catch (e) { /* déjà fermée */ }
				resolve(result);
			}
			function onOk() { finish(true); }
			function onCancel() { finish(false); }
			function onDlgCancel(e) { e.preventDefault(); finish(false); }

			okBtn.addEventListener('click', onOk);
			cancelBtn.addEventListener('click', onCancel);
			dlg.addEventListener('cancel', onDlgCancel);

			try { dlg.showModal(); } catch (e) { /* déjà ouverte */ }
			okBtn.focus();
		});
	};
})();
