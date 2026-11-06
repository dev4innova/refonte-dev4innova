# Contribuer

1. Partir de `main` à jour : `git switch -c feat/TASK-XXX-description`.
2. Lire `CLAUDE.md` et la règle de `docs/rules/` correspondant à la zone modifiée.
3. Développer avec les tests ; lint, typecheck et tests doivent passer localement.
4. Commits au format Conventional Commits (`docs/rules/commits.md`), avec `Refs: TASK-XXX`.
5. Ouvrir une Pull Request vers `main` en remplissant le modèle ; au moins une relecture.
6. Squash merge une fois la CI verte.

Toute décision d'architecture nouvelle s'accompagne d'un ADR (`docs/adr/template.md`).
