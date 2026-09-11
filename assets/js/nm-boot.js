/* ============================================================
   AMORÇAGE — espace de noms NM et promesse d'accès à la base
   ------------------------------------------------------------
   À charger EN PREMIER dans le <head>, avant tous les autres
   scripts du site. Il crée `window.NM.dbReady`, une promesse
   résolue par assets/js/supabase-client.js dès que le client
   Supabase est prêt.

   Cela permet à n'importe quel script classique d'écrire :
       NM.dbReady.then(db => db.saveLead(...))
   sans se soucier de l'ordre de chargement des modules.
   ============================================================ */
(function (root) {
	'use strict';

	var NM = root.NM || {};

	if (!NM.dbReady) {
		NM.dbReady = new Promise(function (resolve, reject) {
			NM._resolveDb = resolve;
			NM._rejectDb = reject;
		});
		// Évite un « unhandled rejection » si aucune page n'attend la base.
		NM.dbReady.catch(function () { /* la page n'utilise pas Supabase */ });
	}

	root.NM = NM;
})(window);
