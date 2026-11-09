# ADR-0017 — Commerce et facturation : Stripe Checkout, factures émises par la plateforme

- **Statut** : Proposé (prestataire, émission des factures, catalogue et acceptation des devis
  validés par le responsable du projet le 2026-11-09 ; ADR à accepter formellement)
- **Date** : 2026-11-09
- **Tâches liées** : TASK-110 → TASK-115 ; s'appuie sur l'ADR-0006 (multi-tenancy), l'ADR-0011
  (CRM) et l'ADR-0016 (Academy)

## Contexte
L'EPIC 13 permet de vendre : prestations sur devis, abonnements et formations de l'Academy.
Les factures françaises obéissent à des règles strictes (numérotation continue, mentions
obligatoires, conservation 10 ans) et la facture électronique devient obligatoire par étapes à
partir de 2026. Aucune donnée de carte ne doit transiter par nos serveurs (règles de sécurité).

## Décision
- **Paiement : Stripe**, uniquement par ses pages **Checkout hébergées** (carte, prélèvement
  SEPA ; PCI DSS SAQ A). Client HTTP minimal (pas de SDK) : clients Stripe, sessions Checkout
  (`price_data` en ligne, sans catalogue côté Stripe), abonnements, résiliation en fin de période.
  Ce qui est payé n'est cru qu'à réception d'un **webhook signé** (HMAC SHA-256, tolérance
  5 minutes), traité **une seule fois** (table des événements) et de façon idempotente.
  Clés `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` côté API uniquement.
  En local et en CI, une **passerelle simulée** (`BILLING_SIMULATED_PAYMENTS`, jamais en
  production) sert la page de paiement depuis l'API et produit les mêmes événements.
- **Factures émises par la plateforme** : numérotation continue sans trou par série et par année
  (`F-2026-0001` factures, `A-2026-0001` avoirs, `D-2026-0001` devis), compteur verrouillé dans
  la transaction qui l'utilise. À l'émission, les coordonnées du vendeur (`BILLING_SELLER_*`) et
  du client (profil de facturation de l'organisation) et les lignes sont **copiées** : une
  facture ne change plus, sauf ce qui est payé. Une erreur se corrige par un **avoir** total qui
  annule la facture. Montants en centimes, TVA par ligne arrondie au demi supérieur, ventilée
  par taux. PDF avec les mentions légales (échéance, pénalités de retard, indemnité forfaitaire
  de 40 € pour les professionnels). Les organisations ayant des factures ne peuvent pas être
  supprimées (contrainte `RESTRICT`).
- **Catalogue** (organisation interne, `billing:admin` : `staff_admin`, `staff_sales`) :
  prestations (lignes de devis), abonnements mensuels ou annuels, formations payantes liées à
  une formation de l'Academy (l'inscription libre est alors refusée : paiement requis).
- **Devis acceptés en ligne** : l'équipe rédige le devis (lié ou non à une opportunité CRM), le
  brouillon n'est jamais visible du client ; une fois envoyé, les `owner`/`admin` du client
  (`billing:manage`) l'acceptent (nom saisi + case « bon pour accord », horodatés) ou le
  refusent. L'acceptation émet aussitôt la facture d'**acompte** (pourcentage du devis, ventilé
  par taux de TVA) ou la facture totale ; l'équipe émet ensuite la facture de **solde** (toutes
  les lignes moins les acomptes). Un profil de facturation est exigé avant l'acceptation.
- **Abonnements** : souscrits depuis le portail (Checkout en mode abonnement) ; chaque période
  payée chez Stripe (`invoice.paid`) donne **notre** facture, déjà payée. Résiliation en fin de
  période depuis le portail. Stripe envoie aussi ses propres reçus ; la facture légale est la nôtre.
- **Formations payantes** : achetées depuis la page de la formation, facturées à une organisation
  dont l'acheteur est `owner`/`admin`, ou **à titre personnel** (un espace de facturation
  personnel est créé une fois) ; le webhook émet la facture payée et inscrit l'acheteur.
- **Transactions** : paiements Stripe et virements enregistrés par l'équipe (référence unique).

## Conséquences
- Facture électronique (réforme 2026-2027) : export Factur-X et dépôt via une plateforme agréée
  à prévoir dans un ADR dédié avant les échéances légales applicables à DEV4INNOVA.
- TVA : taux saisis par produit et par ligne ; pas d'autoliquidation intracommunautaire
  automatique ni de calcul de TVA par pays (à traiter si l'activité l'exige).
- Remboursements : hors plateforme (tableau de bord Stripe ou virement), après émission de l'avoir.
- Configurer en production : clés Stripe, URL du webhook (`/api/v1/billing/webhooks/stripe`,
  événements `checkout.session.*`, `invoice.paid`, `customer.subscription.*`), coordonnées du
  vendeur ; conserver les factures 10 ans (sauvegardes, EPIC 14).
