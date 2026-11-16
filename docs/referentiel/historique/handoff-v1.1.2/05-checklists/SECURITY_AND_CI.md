# Checklist CI et sécurité

- [ ] Inventorier `.github/workflows` et scripts package.
- [ ] Vérifier les checks réellement exécutés sur PR.
- [ ] Ne pas supprimer un contrôle existant sans décision documentée.
- [ ] Vérifier `.env.example`, `.gitignore`, gitleaks et exposition dans les logs.
- [ ] Vérifier dépendances, lockfile, Dependabot et CodeQL si présents.
- [ ] Revalider protection de main : PR, checks, conversations, force-push, suppression, bypass.
- [ ] Mesurer Critical/High au lieu de supposer leur absence.
