# Chantier : KPI

**Niveau actuel : 0 (table D1 + requêtes documentées)**

Table `evenements` (`worker/schema.sql`) : `type` ∈ {demande, maquette_servie, exception, reponse, refus, erreur, support}.

Requêtes (`npx wrangler d1 execute kermiclab-kpi --remote --command "<requête>"`) :

```sql
-- Nombre de demandes par jour
SELECT date(horodatage) AS jour, COUNT(*) FROM evenements WHERE type = 'demande' GROUP BY jour ORDER BY jour DESC;

-- Taux de couverture du catalogue (maquettes servies / demandes)
SELECT ROUND(100.0 * SUM(type = 'maquette_servie') / NULLIF(SUM(type = 'demande'), 0), 1) AS couverture_pct FROM evenements;

-- Nombre d'exceptions (maquette pertinente mais absente) par sujet
SELECT sujet, COUNT(*) AS n FROM evenements WHERE type = 'exception' GROUP BY sujet ORDER BY n DESC;

-- Maquettes les plus servies
SELECT maquette_id, COUNT(*) AS n FROM evenements WHERE type = 'maquette_servie' GROUP BY maquette_id ORDER BY n DESC;

-- Refus par raison
SELECT detail, COUNT(*) AS n FROM evenements WHERE type = 'refus' GROUP BY detail ORDER BY n DESC;
```

Prochaines étapes : tableau de bord, purge automatique au-delà de 13 mois.
