# Budget familial — app iPhone (web app installable)

Une app à ajouter à l'écran d'accueil de vos iPhone, sans App Store ni Xcode.
Le budget est enregistré en ligne (Supabase) et se met à jour en direct sur les deux téléphones.
Elle fonctionne aussi hors ligne : ce que vous saisissez part dès que le réseau revient.

**Ce qu'elle fait**

- **Accueil** : pour le mois choisi, l'épargne possible, ce qu'il faut mettre de côté sur les livrets et ce qu'il reste à dépenser dans les enveloppes.
- **Bouton +** : saisir une dépense en 3 secondes (montant → enveloppe → Ajouter). La catégorie suit l'enveloppe, et se change d'un toucher.
- **Dépenses** : l'état de chaque enveloppe et la liste des saisies du mois, avec qui les a faites.
- **Recherche** : la loupe en haut de **Accueil** et de **Dépenses** ouvre une recherche sur toutes les saisies, revenus et charges. Tapez plusieurs mots (ils doivent tous correspondre) : un libellé, une enveloppe, une catégorie, une personne, un montant (`45`, `45,50`, `>100`, `<20`, `50..120`) ou une date (`mars`, `2026`, `12/03/2026`, `03/2026`, `>=01/03/2026`, `01/03..15/03`). Touchez un résultat pour le modifier.
- **Analyse** : pour le mois (ou toute l'année), la balance entrées / sorties, un anneau des dépenses (ou des revenus) par catégorie, le budget consommé, les récurrences. Touchez une catégorie pour voir ses lignes.
- **Budget** : revenus, charges mensuelles, dépenses annuelles à provisionner, enveloppes, et **Catégories** (créer, renommer, choisir icône et couleur, supprimer).
- **Livrets** : solde projeté de chaque livret mois par mois (alerte s'il manquera de l'argent), virements de chacun vers le compte joint, mois type.

Installation : environ 20 minutes, une seule fois.

---

## 1. Créer la base de données (Supabase, gratuit)

1. Créez un compte sur <https://supabase.com>, puis **New project** (région : *West EU (Paris)*). Notez le mot de passe de la base (il ne vous sera pas redemandé ici).
2. Une fois le projet prêt : **SQL Editor** → **New query** → collez tout le contenu de `supabase/schema.sql` → **Run**.
   Le message « Success. No rows returned » est normal.

## 2. Configurer la connexion (e-mail + mot de passe)

L'app se connecte avec un e-mail et un mot de passe : **aucun e-mail n'est envoyé**, donc pas de limite d'envoi ni de SMTP à configurer.

1. **Authentication → Sign In / Providers → Email** : laissez **Enable Email provider** activé et **désactivez « Confirm email »** → **Save**.
   (Si « Confirm email » reste activé, Supabase attend un e-mail de confirmation et la création de compte échoue.)
2. **Authentication → URL Configuration** : *Site URL* = l'adresse GitHub Pages de l'étape 5 (par ex. `https://VOTRE-PSEUDO.github.io/flouz/`).

> **Un compte a déjà été créé sans mot de passe ?** Si vous avez essayé l'ancienne connexion par e-mail, l'adresse existe peut-être déjà dans **Authentication → Users**. Supprimez-la (menu **⋯ → Delete user**), puis créez le compte depuis l'app.

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
3. Première fois : **Se connecter** → **Première fois ? Créer un compte** (e-mail + mot de passe de 8 caractères minimum). Le second téléphone crée aussi son propre compte, avec son e-mail.

**Premier téléphone** : *Créer un foyer* (avec ou sans montants d'exemple).
Allez ensuite dans **Réglages** (roue dentée) → **Partager le code**.
**Second téléphone** : *Rejoindre un foyer* avec ce code.

## 7. Verrouiller le projet (une fois connectés tous les deux)

1. **Bloquer les nouvelles inscriptions** : **Authentication → Sign In / Providers** → décochez **Allow new users to sign up** → **Save**.
   Vos deux comptes continuent de fonctionner ; plus personne ne peut créer de compte ni de foyer sur votre projet.
   Pour ajouter quelqu'un plus tard, recochez la case le temps de sa première connexion.
2. **Mot de passe** : dans **Authentication → Sign In / Providers → Email**, fixez **Minimum password length** à 8 ou plus.

Rappel : seule la clé *anon / publishable* va dans `config.js`. La clé *service_role / secret* ne doit jamais apparaître dans l'app ni sur GitHub.

## 8. Reprendre vos montants de la version web

Dans la version web (artifact Claude) : **Réglages → Exporter (JSON)**.
Dans l'app : **Réglages → Importer…** et choisissez le fichier (depuis Fichiers / iCloud Drive).
L'import remplace le contenu du budget.

---

## Mise à jour : catégories et onglet Analyse

Si votre base Supabase existe déjà, **relancez `supabase/schema.sql`** (SQL Editor → New query → coller → Run) : il autorise le nouveau type de ligne « categorie ». Tant que ce n'est pas fait, l'app fonctionne mais affiche « Mettez à jour le SQL » et garde les catégories sur le téléphone sans les envoyer.
Les 17 catégories de départ (12 de dépenses, 5 de revenus) sont créées au premier lancement ; modifiez-les dans **Budget → Catégories**. Les anciennes saisies reprennent la catégorie de leur enveloppe (devinée d'après son nom, modifiable dans l'enveloppe) ; le reste apparaît dans « À catégoriser ».

## Importer un relevé bancaire

**Réglages → Importer…** accepte aussi un fichier `releve-bancaire` (le dossier `releves/` est ignoré par git : vos relevés restent chez vous, ils ne sont jamais publiés avec le code). Contrairement à la sauvegarde JSON, il **ajoute** sans rien remplacer :

- un débit devient une **dépense** (sans enveloppe, rangée sous « Relevé bancaire ») et un crédit un **revenu ponctuel** du mois ;
- chaque opération porte une `ref` : réimporter le même fichier n'ajoute aucun doublon ;
- les catégories sont celles proposées dans le fichier ; ce qui n'a pas pu être deviné reste dans « À catégoriser » (Analyse), à ranger d'un toucher ;
- seules les opérations de l'année du budget sont importées.
- `personne` et `par` (facultatifs, au niveau du fichier) fixent à qui sont attribués les revenus et les dépenses (ex. `"personne": "Commun", "par": "Compte commun"` pour le compte joint) ; sinon, c'est la personne qui importe.

Format : `{"format":"releve-bancaire","operations":[{"ref":"…","date":"2026-09-08","libelle":"…","montant":-12.0,"categorie":"c-alim"}]}` (montant négatif = débit ; ids de catégories : `c-alim`, `c-auto`, `r-salaire`…).

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
