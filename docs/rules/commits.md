# Conventions de commits et de branches

## Format (Conventional Commits)
```
<type>(<scope>): <sujet à l'impératif, en anglais, minuscule, sans point final>

[corps optionnel : le pourquoi, pas le comment]

Refs: TASK-XXX
```
Vérifié par commitlint (`commitlint.config.mjs`). En-tête ≤ 100 caractères.

### Types
| Type | Usage |
|---|---|
| `feat` | nouvelle fonctionnalité |
| `fix` | correction de bug |
| `docs` | documentation uniquement |
| `style` | formatage, sans changement de logique |
| `refactor` | restructuration sans changement de comportement |
| `perf` | amélioration de performance |
| `test` | ajout ou correction de tests |
| `build` | build, dépendances, Docker |
| `ci` | pipeline CI/CD |
| `chore` | maintenance diverse |
| `revert` | annulation d'un commit |

### Scopes
`web`, `api`, `db`, `infra`, `ui`, `i18n`, `auth`, `cms`, `crm`, `ai`, `diagnostic`,
`portal`, `academy`, `billing`, `docs`, `deps`, `repo`.

### Exemples
```
feat(api): add health check endpoint

Refs: TASK-019
```
```
fix(auth)!: reject tokens without audience claim

BREAKING CHANGE: clients must request tokens with the `api` audience.
Refs: TASK-039
```

## Règles
- Un commit = un changement logique cohérent qui compile et passe les tests.
- `!` après le scope + pied `BREAKING CHANGE:` pour toute rupture de contrat (API, schéma, env).
- Pied `Refs: TASK-XXX` obligatoire quand le commit se rattache au backlog.
- Ne jamais committer de secrets, de fichiers `.env`, de builds ou de `node_modules`.

## Branches
- `main` : toujours déployable, protégée, modifiée uniquement par Pull Request.
- Branches de travail : `<type>/TASK-XXX-description-courte`
  (ex. `feat/TASK-019-health-checks`, `docs/TASK-009-adr`).
- Fusion par **squash merge** ; le titre de la PR suit le format Conventional Commits.
