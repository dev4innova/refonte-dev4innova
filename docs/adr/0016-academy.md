# ADR-0016 — Academy : formations rédigées dans le back-office, quiz corrigés par le serveur, certificats vérifiables

- **Statut** : Proposé (inscriptions, rédaction, quiz et certificats validés par le responsable du
  projet le 2026-11-08 ; ADR à accepter formellement)
- **Date** : 2026-11-08
- **Tâches liées** : TASK-103 → TASK-109 ; s'appuie sur l'ADR-0006 (multi-tenancy) et l'ADR-0010 (rendu Markdown)

## Contexte
L'EPIC 12 ouvre des formations en ligne : un catalogue public, un parcours apprenant suivi,
des quiz et un certificat. Le paiement n'existe pas encore (EPIC 13) ; les clients B2B veulent
aussi former leurs équipes et suivre leur progression.

## Décision
- **Contenu** : formations, modules, leçons et questions appartiennent à l'organisation interne
  et sont rédigés dans `/admin/academy` (`academy:manage` : `staff_admin`, `staff_editor`). Les
  textes sont stockés par langue (JSONB `{"fr", "en"}`) ; le Markdown est rendu et assaini à
  l'enregistrement avec le même moteur que le CMS. Le français est obligatoire ; la
  **publication exige l'anglais partout** et au moins une leçon par module (liste de ce qui
  manque fournie par l'API). Repasser en brouillon masque la formation du catalogue et de ses
  apprenants ; on ne supprime qu'une formation sans inscrit.
- **Vidéo** : lien YouTube ou Vimeo facultatif, converti en lecteur respectueux de la vie privée
  (`youtube-nocookie.com`, Vimeo `dnt=1`) ; tout autre hôte est refusé. Iframe en `sandbox`.
- **Inscriptions** : gratuites. Une formation **publique** est au catalogue et toute personne
  connectée s'y inscrit seule. Une formation **réservée** n'apparaît pas au catalogue : l'équipe y
  inscrit des membres d'une organisation cliente, qui devient « commanditaire ». Les `owner` et
  `admin` de cette organisation (`academy:report`) suivent la progression de ces seuls membres.
- **Progression** : leçons marquées terminées par l'apprenant ; quiz à choix unique par module,
  **corrigés par le serveur** (les bonnes réponses ne sont jamais envoyées avant correction),
  réussis à 70 %, tentatives illimitées, explications après correction.
- **Certificat** : délivré automatiquement quand toutes les leçons sont terminées et tous les
  quiz réussis. Code aléatoire lisible (`D4I-XXXX-XXXX-XXXX`, environ 60 bits), page publique de
  vérification `/academy/certificat/{code}` (non indexée) et PDF généré par l'API (ReportLab).
  Le nom de l'apprenant et le titre de la formation sont figés à la délivrance ; le certificat
  reste valable si la formation est dépubliée ou l'inscription retirée.

## Conséquences
- Pas de formations payantes avant l'EPIC 13 (le modèle d'inscription devra intégrer le paiement).
- La page de vérification affiche le nom de l'apprenant à qui possède le code : c'est voulu
  (partage avec un employeur) ; à mentionner dans la politique de confidentialité.
- `SITE_URL` doit être renseigné côté API pour le lien imprimé sur les certificats.
- Révocation d'un certificat : prévue dans le modèle (`revoked_at`), sans interface pour l'instant.
