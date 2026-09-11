/* ============================================================
   NOTIFICATIONS RDV — Google Agenda + Gmail (Google Apps Script)
   ------------------------------------------------------------
   Remplace Zapier : gratuit, tourne sur votre propre compte
   Google, pas d'abonnement. Dès qu'une demande de rendez-vous ou
   un brief projet arrive sur le site, Supabase appelle ce script,
   qui :
     • crée l'événement dans VOTRE Google Agenda (pour un RDV) ;
     • vous envoie un e-mail récapitulatif ;
     • envoie un accusé de réception au client (si son e-mail est
       connu).

   INSTALLATION (5 minutes, à faire une seule fois) :
     1. Ouvrez https://script.google.com/ avec votre compte Google.
     2. Nouveau projet → collez tout le contenu de ce fichier à la
        place du code par défaut.
     3. Juste en dessous, remplacez CHANGE_ME par un mot de passe
        de votre choix (gardez-le en tête).
     4. Déployer → Nouveau déploiement → type "Application web" →
        Exécuter en tant que : Moi · Qui a accès : Tout le monde →
        Déployer. Autorisez l'accès à l'agenda et à Gmail quand
        Google le demande (c'est votre propre script, sur votre
        propre compte : c'est normal).
     5. Copiez l'adresse fournie (…/exec), ajoutez ?key= suivi de
        votre mot de passe, et collez le tout dans /admin/ →
        Réglages, dans les deux champs de notification.

   Pour une explication détaillée avec captures d'écran : voir
   DOCUMENTATION.md, section « Notifications automatiques ».
   ============================================================ */

// Mot de passe qui protège ce script : sans lui, personne ne peut
// remplir votre agenda ou vous spammer. Changez cette valeur.
var SECRET = 'CHANGE_ME';

// Adresse qui reçoit les notifications (vous).
var NOTIFY_EMAIL = 'nathan.marzilli@gmail.com';

// Durée par défaut d'un rendez-vous découverte, en minutes.
var RDV_DURATION_MIN = 30;

function doPost(e) {
	try {
		if (!e || !e.parameter || e.parameter.key !== SECRET) {
			return ContentService.createTextOutput('forbidden');
		}
		if (!e.postData || !e.postData.contents) {
			return ContentService.createTextOutput('empty body');
		}

		var data = JSON.parse(e.postData.contents);

		if (data.source_table === 'nm_leads') {
			handleLead(data);
		} else if (data.source_table === 'nm_briefs') {
			handleBrief(data);
		}
	} catch (err) {
		// On journalise mais on répond toujours 200 : un souci ici ne
		// doit jamais faire échouer l'enregistrement côté site.
		console.error(err);
	}
	return ContentService.createTextOutput('ok');
}

function handleLead(lead) {
	// 1. Événement dans l'agenda, si une date/heure a été choisie.
	if (lead.rdv_date && lead.rdv_time) {
		try {
			var start = new Date(lead.rdv_date + 'T' + lead.rdv_time + ':00');
			var end = new Date(start.getTime() + RDV_DURATION_MIN * 60000);
			var title = 'RDV — ' + fullName(lead) + (lead.pack_label ? ' (' + lead.pack_label + ')' : '');
			CalendarApp.getDefaultCalendar().createEvent(title, start, end, {
				description: leadSummary(lead),
				location: lead.phone || ''
			});
		} catch (err) {
			console.error('Création événement agenda impossible : ' + err);
		}
	}

	// 2. E-mail récapitulatif, toujours envoyé.
	try {
		MailApp.sendEmail({
			to: NOTIFY_EMAIL,
			subject: '🔔 Nouvelle demande — ' + fullName(lead),
			body: leadSummary(lead)
		});
	} catch (err) {
		console.error('Envoi e-mail (notification) impossible : ' + err);
	}

	// 3. Accusé de réception au client, si son e-mail est connu.
	if (lead.email) {
		try {
			MailApp.sendEmail({
				to: lead.email,
				subject: 'Votre demande est bien enregistrée',
				body: 'Bonjour ' + (lead.first_name || '') + ',\n\n' +
					'Votre demande vient d’être enregistrée' +
					(lead.rdv_label ? (', avec un rendez-vous prévu le ' + lead.rdv_label) : '') +
					'. Nathan revient vers vous très vite.\n\n' +
					'À bientôt,\nClic à l’aide'
			});
		} catch (err) {
			// E-mail client invalide ou indisponible : on n'empêche rien.
			console.error('Envoi accusé de réception impossible : ' + err);
		}
	}
}

function handleBrief(brief) {
	var lines = [];
	lines.push('Contact : ' + (brief.contact_name || ''));
	if (brief.organisation) lines.push('Structure : ' + brief.organisation);
	if (brief.email) lines.push('E-mail : ' + brief.email);
	if (brief.pack) lines.push('Offre : ' + brief.pack);
	if (brief.payload) {
		lines.push('');
		lines.push('Détail du brief :');
		lines.push(JSON.stringify(brief.payload, null, 2));
	}

	try {
		MailApp.sendEmail({
			to: NOTIFY_EMAIL,
			subject: '📋 Nouveau brief projet — ' + (brief.contact_name || ''),
			body: lines.join('\n')
		});
	} catch (err) {
		console.error('Envoi e-mail (brief) impossible : ' + err);
	}
}

function fullName(lead) {
	return ((lead.first_name || '') + ' ' + (lead.last_name || '')).trim() || 'Sans nom';
}

function leadSummary(lead) {
	var lines = [];
	lines.push('Nom : ' + fullName(lead));
	if (lead.organisation) lines.push('Structure : ' + lead.organisation);
	if (lead.email) lines.push('E-mail : ' + lead.email);
	if (lead.phone) lines.push('Téléphone : ' + lead.phone);
	if (lead.rdv_label) lines.push('Rendez-vous : ' + lead.rdv_label);
	if (lead.pack_label) lines.push('Offre : ' + lead.pack_label);
	if (lead.serenity_tier) lines.push('Suivi : ' + lead.serenity_tier + (lead.serenity_cycle ? ' (' + lead.serenity_cycle + ')' : ''));
	if (lead.documents && lead.documents.length) lines.push('Documents : ' + lead.documents.join(', '));
	if (lead.club_options && lead.club_options.length) lines.push('Modules club : ' + lead.club_options.join(', '));
	if (lead.intervention_type) lines.push('Intervention : ' + lead.intervention_type);
	if (lead.estimated_total != null && lead.estimated_total !== '') {
		lines.push('Estimation : ' + lead.estimated_total + ' ' + (lead.currency || 'EUR'));
	}
	if (lead.message) lines.push('Message : ' + lead.message);
	lines.push('Source : ' + (lead.source || ''));
	return lines.join('\n');
}
