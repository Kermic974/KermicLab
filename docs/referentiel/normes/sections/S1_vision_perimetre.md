# S1 — Vision et périmètre

| Section | Version | Statut | Dépend de |
|---|---|---|---|
| S1 | 1.2.0 | 🟢 ADOPTÉE (reconstruite, texte primaire non fourni) | — |

## 1. Vision

KermicLab est une plateforme éducative numérique ouverte, évolutive et multidisciplinaire. **[B]** (notebook) Elle repose sur un **référentiel pédagogique canonique** qui relie connaissances, capacités observables, compétences, curriculum et expériences d'apprentissage.

**[B]** Principe directeur : construire un **système de connaissance** avant une collection de contenus.

## 2. Public et cible académique

- **[B]** Utilisateur principal : l'apprenant, de 7 à 77 ans, mineurs compris.
- **[B]** Cible académique : système scolaire français, du cycle 1 à la terminale, avec déploiement progressif.
- **[B]** Première verticale industrialisée : les mathématiques. L'architecture ne doit pas être verrouillée sur une seule discipline.

## 3. Invariants produit

| # | Invariant | Origine |
|---|---|---|
| S1-1 | Une même connaissance n'est représentée qu'une fois, quel que soit le nombre de classes ou de programmes où elle apparaît. | [B] |
| S1-2 | Le référentiel canonique est séparé des données individuelles des apprenants. | [B] |
| S1-3 | Le référentiel est versionnable, auditable et vérifiable sans intervention d'une IA pour les règles bloquantes. | [B] |
| S1-4 | La validation documentaire d'une règle ne prouve jamais sa mise en œuvre technique. | [B] |
| S1-5 | Le référentiel canonique ne dépend pas d'une représentation produit (page, URL, interface). Les produits le consomment par des projections. | [P] |

## 4. Périmètre

| Dans S1–S4 | Hors S1–S4 |
|---|---|
| Knowledge Core (Notion, MicroSkill, Skill) | données apprenant (progression, réponses, comptes) |
| Knowledge Graph (Relation) | moteur adaptatif |
| Curriculum Graph (Curriculum, Stage, Domain) | Labs et contenus de pages |
| CurriculumMapping | interface utilisateur |
| validation du référentiel | infrastructure (stockage, hébergement) |

## 5. Rapport avec le produit existant [P]

Le produit en ligne possède déjà des **pages** (« fiches ») identifiées par un slug, avec une version SemVer de contenu. **[R]** Plus de dix contrôles du dépôt dépendent de ces identifiants.

**[P]** Une page n'est pas une Notion : c'est une **représentation produit** qui peut enseigner une ou plusieurs Notions. Le lien entre une page et les objets S4 relève du produit (ADR du dépôt), pas de S4 (invariant S1-5).
