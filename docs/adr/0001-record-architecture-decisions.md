# ADR-0001 — Consigner les décisions d'architecture

- **Statut** : Accepté
- **Date** : 2026-11-06
- **Tâches liées** : TASK-009

## Contexte
Le projet sera développé par des humains et des agents IA sur une longue durée. Sans trace
écrite, les décisions sont rediscutées ou contournées.

## Décision
Toute décision structurante (stack, schéma transverse, sécurité, fournisseur externe) est
consignée dans un ADR de `docs/adr/`. Les agents IA proposent des ADR au statut « Proposé » ;
seul le responsable du projet les passe à « Accepté ».

## Conséquences
Un coût d'écriture faible pour chaque décision ; un historique lisible et une base commune
pour `CLAUDE.md` et les règles de `docs/rules/`.
