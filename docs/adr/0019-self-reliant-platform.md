# ADR-0019 — Plateforme autonome : comptes intégrés, stockage Railway, sans services tiers

- **Statut** : Proposé
- **Date** : 2026-11-10
- **Tâches liées** : TASK-039, TASK-040, TASK-065, TASK-113, TASK-117, TASK-122
- **Remplace** : ADR-0009 (Zitadel) ; modifie ADR-0010 (stockage), ADR-0017 (paiement en
  ligne) et ADR-0018 (Sentry).

## Contexte
La mise en production sur Railway demandait de créer et de relier six comptes externes :
Zitadel (connexion), Scaleway (stockage S3), Stripe (paiement), Sentry (erreurs), plus
Railway et les fournisseurs d'IA. Chaque service ajoutait des identifiants, des URL de
retour, des variables et une panne possible. Le responsable du projet veut une plateforme
développée par l'équipe et déployable sans dépendre de services externes. Il choisira le
moyen de paiement plus tard.

## Décision

### Comptes intégrés (remplace Zitadel)
- L'API gère elle-même les comptes : e-mail unique et mot de passe.
- **Hachage Argon2id** (`argon2-cffi`, paramètres recommandés RFC 9106). Un hachage aux
  paramètres anciens est recalculé à la connexion suivante.
- Mot de passe de **12 à 128 caractères**, différent de l'adresse e-mail.
- **Sessions en base** (`auth_sessions`) :
  - le jeton, 32 octets aléatoires, n'est renvoyé qu'une fois, à la connexion ;
  - seule son empreinte SHA-256 est stockée, donc une fuite de la base ne donne aucun
    jeton utilisable ;
  - durée de vie de 30 jours ;
  - révocation à la déconnexion et au changement de mot de passe, qui ferme aussi les
    autres sessions ;
  - les sessions expirées sont purgées chaque jour (`python -m app.cli daily`).
- **Côté site** : le jeton est rangé dans un cookie `httpOnly`, `SameSite=Lax` et
  `Secure` en HTTPS. Il n'est jamais lisible par le JavaScript de la page et est envoyé à
  l'API en `Authorization: Bearer`.
  - Plus de secret de chiffrement de session à configurer.
  - Les formulaires sont des Server Actions, déjà protégées contre les requêtes inter-sites.
- **Protections** :
  - limitation des tentatives de connexion par client (20 par 15 min) et par adresse
    (10 par 15 min), et des inscriptions par client (10 par heure) ;
  - même réponse et même temps de calcul pour une adresse inconnue ou un mauvais mot de
    passe, pour ne pas révéler quelles adresses ont un compte.
- **Mot de passe oublié** : sans service d'envoi d'e-mails, l'équipe génère un mot de passe
  temporaire. Il est affiché une seule fois et ferme toutes les sessions du compte.
  - Back-office : *Admin → Comptes*, réservé aux `staff_admin` (permission `accounts:manage`).
  - Ou par la CLI : `python -m app.cli reset-password EMAIL`.
- **Inscription libre**, comme les formations gratuites de l'Academy. L'accès aux
  organisations reste donné par leurs propriétaires et administrateurs, ou par l'équipe.

### Stockage sur Railway Buckets (remplace Scaleway)
- Médias du CMS, fichiers du portail et sauvegardes vont dans **trois buckets Railway**
  (S3-compatibles, région Amsterdam), dans le même projet et sur la même facture.
- Les buckets Railway sont **privés** :
  - les fichiers du portail gardent leurs liens signés de courte durée ;
  - les médias publics du site sont **servis par l'API** (`GET /api/v1/media/{clé}`),
    seulement s'ils appartiennent à la médiathèque, avec un cache navigateur d'un an (une
    clé n'est jamais réutilisée).
- Chaque bucket a ses propres identifiants. Le bucket des sauvegardes n'est accessible
  qu'au service `backup`.

### Pas de suivi d'erreurs externe (retrait de Sentry)
Les erreurs se lisent dans les journaux de Railway : lignes JSON avec niveau, identifiant de
requête et trace. Un outil pourra être ajouté plus tard si le volume le justifie.

### Paiement en ligne désactivé (Stripe mis en attente)
- Devis, factures, avoirs et virements restent complets.
- Tant qu'aucun prestataire de paiement n'est configuré (`online_payments` faux) :
  - le paiement par carte et les abonnements sont masqués ;
  - les formations payantes affichent leur prix et « Nous contacter » : l'équipe facture,
    puis inscrit la personne à réception du virement.
- Le code Stripe reste dans le dépôt, inactif. Le choix du prestataire fera l'objet d'un
  nouvel ADR.

### Seule dépendance externe conservée
Les fournisseurs d'IA (Anthropic, OpenAI, Gemini) sont la matière même de l'AI Gateway. Leurs
clés restent optionnelles : sans clé, un fournisseur est « non configuré ».

## Alternatives considérées
- **Garder Zitadel, ou un service équivalent (Auth0, Clerk)** :
  - pour : MFA, connexion sociale et réinitialisation par e-mail tout prêts ;
  - contre : un compte, un domaine, des URL de retour et une panne externe de plus.
  - Écarté par le responsable du projet.
- **Comptes intégrés avec envoi d'e-mails** (vérification d'adresse, lien de
  réinitialisation) : demande un serveur SMTP, donc une dépendance. Reporté : à ajouter quand
  un service d'e-mails sera choisi.
- **Volume Railway ou PostgreSQL pour les fichiers** :
  - un volume empêche plusieurs instances de l'API et coupe le service à chaque déploiement ;
  - PostgreSQL alourdit la base et ses sauvegardes.
- **Retirer tout le code Stripe** : écarté. Il resservira peut-être et ne coûte rien
  désactivé.

## Conséquences
- Plus simple :
  - le déploiement ne demande que Railway (et, au choix, des clés d'IA) ;
  - plus de redirections OIDC, de clés JWKS, ni de secret de cookie.
- Plus difficile :
  - la sécurité des comptes devient notre responsabilité (hachage, limitation, sessions) ;
  - pas de MFA ni de connexion sociale pour l'instant ;
  - réinitialisation manuelle des mots de passe.
- **Migration** (0012) :
  - la colonne `external_subject` disparaît ;
  - les comptes existants gardent leurs données mais n'ont pas de mot de passe : l'équipe
    leur donne un mot de passe temporaire.
- **À prévoir** :
  - envoi d'e-mails (vérification, réinitialisation en libre-service, invitations) ;
  - double authentification (TOTP) pour l'équipe ;
  - choix du prestataire de paiement.
