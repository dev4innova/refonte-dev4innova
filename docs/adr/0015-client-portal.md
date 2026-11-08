# ADR-0015 — Portail client : projets pilotés par l'équipe, fichiers privés, notifications dans l'application

- **Statut** : Proposé (pilotage, stockage, support et notifications validés par le responsable
  du projet le 2026-11-08 ; ADR à accepter formellement)
- **Date** : 2026-11-08
- **Tâches liées** : TASK-096 → TASK-102 ; s'appuie sur l'ADR-0006 (multi-tenancy) et l'ADR-0010 (stockage objet)

## Contexte
L'EPIC 11 ouvre aux clients un espace de suivi de leurs projets avec DEV4INNOVA : avancement,
livrables à valider, documents échangés et support. Ces données sont confidentielles et
propres à chaque organisation cliente ; les fichiers peuvent être volumineux.

## Décision
- **Pilotage par l'équipe** : les projets, tâches et livrables sont créés et mis à jour par le
  staff (`portal:manage`, rôles `staff_admin` et `staff_sales`) depuis `/admin/portal`. Les
  membres de l'organisation cliente (`portal:use`) consultent, commentent tâches et livrables,
  partagent des documents et ouvrent des demandes de support. Seuls les `owner` et `admin`
  (`portal:review`) valident un livrable ou demandent des modifications (commentaire obligatoire).
  Une nouvelle version remplace le fichier précédent (seule la dernière version est conservée)
  et relance la validation.
- **Isolation** : chaque enregistrement porte l'`organization_id` du client ; côté client, toute
  requête filtre sur l'organisation du contexte (`OrgContext`) ; côté staff, on atteint un
  enregistrement par son identifiant et seules les organisations `client` peuvent recevoir un
  projet. Tests d'isolation dans `tests/test_portal.py`.
- **Fichiers privés** : second bucket S3 (`PORTAL_S3_BUCKET`), jamais lisible anonymement, clés
  préfixées par l'organisation. Type détecté d'après le contenu (PDF, Word, Excel, PowerPoint,
  PNG, JPEG, WebP, ZIP, texte), 25 Mo maximum, nom nettoyé. Le téléchargement passe par une
  route Next.js même origine qui demande à l'API, avec le jeton de session, un **lien signé
  valable 5 minutes** (`PORTAL_DOWNLOAD_TTL_SECONDS`), puis redirige le navigateur ; le fichier
  est toujours servi en pièce jointe (`Content-Disposition` sur l'objet et dans le lien).
- **Support** : tickets numérotés (#1001…) avec fil de messages, catégorie, priorité, projet
  facultatif. Une réponse de l'équipe met la demande « en attente du client » (sauf autre
  statut choisi) et l'attribue à son auteur si elle ne l'était pas ; un message du client la
  rouvre. Pas de délais de réponse (SLA) chiffrés pour l'instant.
- **Notifications dans l'application** : une ligne par destinataire (`notifications`), avec un
  type et des données (identifiants et libellés courts) ; le texte est composé par le web en
  FR/EN. Côté client, tous les membres de l'organisation ; côté équipe, le responsable (chef de
  projet, personne attribuée) s'il est encore staff, sinon toute l'équipe `portal:manage`. Un
  ancien membre ne voit plus les notifications de l'organisation. Pas d'e-mail : il viendra avec
  le choix d'un service d'envoi (nouvel ADR).

## Conséquences
- Configurer le bucket privé et son point d'accès public (`PORTAL_S3_PUBLIC_ENDPOINT_URL`) au
  déploiement ; la création d'une organisation cliente reste du ressort du client (EPIC 04).
- La suppression d'une organisation supprime ses enregistrements mais pas ses objets S3 : à
  traiter avec le cycle de vie des organisations (purge des objets sous le préfixe).
- Les notifications lues s'accumulent : une purge (par exemple au-delà de 180 jours) sera à
  ajouter avec les tâches planifiées.
- La politique de confidentialité doit mentionner le portail (documents, échanges de support).
