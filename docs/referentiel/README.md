# Référentiel canonique S4

Documentation du référentiel pédagogique canonique (Notion, MicroSkill, Skill, Relation, Curriculum, Stage, Domain,
CurriculumMapping). Intégration dans le dépôt : [ADR 0026](../decisions/0026-referentiel-canonique-s4.md).

| Chemin | Contenu | Statut |
|---|---|---|
| [`normes/`](normes/README.md) | Baseline normative 1.2.0 : sections S1 à S4.8, 92 règles (`registres/RULE_CATALOG.csv`), 111 fixtures normatives, manifeste d'empreintes | 🟢 adoptée le 2026-11-09 ; validation technique non acquise |
| [`normes/DECISION_FINALE_1.2.0.md`](normes/DECISION_FINALE_1.2.0.md) | Décision du propriétaire qui adopte la baseline | décision |
| [`audit-pre-implementation-2026-11-09.md`](audit-pre-implementation-2026-11-09.md) | Audit croisé normes ↔ dépôt avant implémentation | historique (daté) |
| [`historique/`](historique/) | Sources de la baseline : handoff v1.1.2, proposition S4.2 v1.1.2 | historique, sans autorité propre |

Règles d'usage :

- Ne pas modifier `normes/` hors d'une révision de la baseline. Toute révision met à jour `CHANGELOG.md` et
  `MANIFEST.json` du paquet.
- L'audit est un document daté. Son classement « migrate » de l'identifiant et de la version des pages est remplacé
  par l'ADR 0026 (slug et SemVer des pages inchangés).
- Le référentiel lui-même (objets JSON) vivra dans `referentiel/` à la racine (ADR 0026, étapes 2 et suivantes).
