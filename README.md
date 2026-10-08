# Budget familial — app iPhone (web app installable)

Une app à ajouter à l'écran d'accueil de vos iPhone, sans App Store ni Xcode.
Le budget est enregistré en ligne (Supabase) et se met à jour en direct sur les deux téléphones.
Elle fonctionne aussi hors ligne : ce que vous saisissez part dès que le réseau revient.

**Ce qu'elle fait**

- **Accueil** : pour le mois choisi, l'épargne possible, ce qu'il faut mettre de côté sur les livrets et ce qu'il reste à dépenser dans les enveloppes.
- **Bouton +** : saisir une dépense en 3 secondes (montant → enveloppe → Ajouter).
- **Dépenses** : l'état de chaque enveloppe et la liste des saisies du mois, avec qui les a faites.
- **Budget** : revenus, charges mensuelles, dépenses annuelles à provisionner, enveloppes.
- **Livrets** : solde projeté de chaque livret mois par mois (alerte s'il manquera de l'argent), virements de chacun vers le compte joint, mois type.

Installation : environ 20 minutes, une seule fois.

---

## 1. Créer la base de données (Supabase, gratuit)

1. Créez un compte sur <https://supabase.com>, puis **New project** (région : *West EU (Paris)*). Notez le mot de passe de la base (il ne vous sera pas redemandé ici).
2. Une fois le projet prêt : **SQL Editor** → **New query** → collez tout le contenu de `supabase/schema.sql` → **Run**.
   Le message « Success. No rows returned » est normal.

## 2. Configurer la connexion par code e-mail

L'app se connecte sans mot de passe : on reçoit un code à 6 chiffres par e-mail.

1. **Authentication → Emails → Templates** :
   - modèle **Magic Link** : remplacez le contenu par par exemple
     `<h2>Budget familial</h2><p>Votre code de connexion : <b>{{ .Token }}</b></p>`
   - faites de même pour le modèle **Confirm signup** (utilisé à la toute première connexion).
2. **Authentication → URL Configuration** : *Site URL* = l'adresse GitHub Pages de l'étape 5 (vous pourrez la compléter après).

> **Important : l'e-mail par défaut de Supabase n'envoie qu'aux membres de l'équipe du projet**, et au plus 2 e-mails par heure.
> Deux solutions pour que votre partenaire reçoive son code :
> - **Simple** : invitez son adresse dans votre organisation Supabase (**Organization → Team → Invite**). Les 2 e-mails/heure suffisent : on ne se reconnecte presque jamais, la session reste ouverte.
> - **Plus souple** : branchez un service d'envoi gratuit (Brevo, Resend…) dans **Authentication → Emails → SMTP Settings**.

## 3. Récupérer les clés

**Project Settings → API** (ou **Data API**) : copiez
- la *Project URL* (`https://xxxx.supabase.co`)
- la clé publique *anon / publishable*.

## 4. Renseigner `config.js`

```js
window.BUDGET_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJ...ou sb_publishable_..."
};
```

Cette clé est faite pour être publique : sans connexion, elle ne donne accès à rien. Les règles de sécurité de `schema.sql` réservent chaque budget aux membres de son foyer.
**Ne mettez jamais** la clé *service_role / secret* dans ce fichier.

## 5. Mettre l'app en ligne (GitHub Pages, gratuit)

1. Sur GitHub : **New repository** (par ex. `budget-familial`), **public** (GitHub Pages est gratuit pour les dépôts publics ; seul le code est visible, pas vos données).
2. **Add file → Upload files** : glissez **tout le contenu** de ce dossier (y compris `.nojekyll`, `icons/`, `vendor/`, `supabase/`) → **Commit**.
3. **Settings → Pages** → *Source* : **Deploy from a branch**, branche `main`, dossier `/ (root)` → **Save**.
4. Après 1 à 2 minutes, l'adresse s'affiche : `https://VOTRE-PSEUDO.github.io/budget-familial/`. Reportez-la dans *Site URL* (étape 2).

## 6. Installer sur les iPhone

Sur chaque iPhone :
1. Ouvrez l'adresse dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
2. **Ouvrez l'app depuis l'icône** (pas depuis Safari : les deux ne partagent pas la connexion).
3. Entrez votre e-mail, puis le code reçu.

**Premier téléphone** : *Créer un foyer* (avec ou sans montants d'exemple).
Allez ensuite dans **Réglages** (roue dentée) → **Partager le code**.
**Second téléphone** : *Rejoindre un foyer* avec ce code.

## 7. Verrouiller le projet (une fois connectés tous les deux)

1. **Bloquer les nouvelles inscriptions** : **Authentication → Sign In / Providers** → décochez **Allow new users to sign up** → **Save**.
   Vos deux comptes continuent de fonctionner ; plus personne ne peut créer de compte ni de foyer sur votre projet.
   Pour ajouter quelqu'un plus tard, recochez la case le temps de sa première connexion.
2. **Raccourcir la validité du code e-mail** : **Authentication → Sign In / Providers → Email** → **Email OTP Expiration** : `600` secondes (10 minutes) au lieu de 3600.

Rappel : seule la clé *anon / publishable* va dans `config.js`. La clé *service_role / secret* ne doit jamais apparaître dans l'app ni sur GitHub.

## 8. Reprendre vos montants de la version web

Dans la version web (artifact Claude) : **Réglages → Exporter (JSON)**.
Dans l'app : **Réglages → Importer…** et choisissez le fichier (depuis Fichiers / iCloud Drive).
L'import remplace le contenu du budget.

---

## Bon à savoir

- **Pas de réinstallation** : rien n'expire. Quand vous modifiez le code sur GitHub, l'app se met à jour à la prochaine ouverture (pensez à changer `VERSION` dans `sw.js`).
- **Pause Supabase** : l'offre gratuite met en pause un projet resté **7 jours sans aucune activité**. Avec un usage normal, ça n'arrive pas ; sinon, un clic sur *Restore* dans la console Supabase.
- **Modifications en même temps** : chaque ligne (une dépense, une charge…) est synchronisée séparément. Deux personnes peuvent saisir en même temps sans rien perdre ; si les deux modifient exactement la même ligne, la dernière modification gagne.
- **Hors ligne** : les saisies restent sur le téléphone (« Hors ligne · n en attente ») et partent automatiquement au retour du réseau.
- **Sauvegarde** : Réglages → Exporter, de temps en temps.
- **Mode démo** : sans configuration, l'écran d'accueil propose d'essayer l'app avec l'exemple, données gardées sur le téléphone uniquement.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css`, `app.js` | L'application |
| `config.js` | Adresse et clé Supabase (à remplir) |
| `example.js` | Montants d'exemple proposés à la création du foyer |
| `manifest.webmanifest`, `icons/` | Installation sur l'écran d'accueil |
| `sw.js` | Fonctionnement hors ligne et mises à jour |
| `vendor/supabase.js` | Bibliothèque Supabase (v2.117.3) |
| `supabase/schema.sql` | Tables, règles de sécurité, invitations, temps réel |
