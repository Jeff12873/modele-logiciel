# Règles de travail (Claude Code)

## Langue
- Tout en français : réponses, interface, aide, messages de commit, commentaires du code.

## Dépôt public = coquille vide
- Jamais de donnée personnelle, de chemin personnel, d'adresse e-mail ni de secret dans le dépôt.
- Les secrets passent par les secrets GitHub et sont écrits au build dans `bureau/secrets.json` (ignoré par git).
- La configuration propre à un ordinateur vit dans `~/.config/<Nom>/config.json`, les données dans les fichiers de l'utilisateur.

## Avant d'agir
- Une demande floue ou un choix de conception : poser un QCM court (options avec une recommandée), puis agir.
- Ne jamais toucher aux vraies données pour tester : travailler sur une copie dans un dossier temporaire,
  avec une configuration de test qu'on supprime ensuite.

## Architecture (à respecter)
- `index.html` n'a aucun accès système : tout passe par `window.appli` (`bureau/preload.js`).
- Chaque nouvelle action système = un `ipcMain.handle` dans `main.js` + une ligne dans `preload.js`,
  avec vérification des arguments (chemins dans le coffre, formats).
- Écritures : `coffre.ecrireAtomique`, frontmatter via `changerCle`, contrôle du mtime avant d'écrire.
- Un service extérieur = son propre module dans `bureau/`, avec un mode simulé pour les tests.
- Couleurs = variables CSS (clair et sombre) ; temporisations = constante `TEMPO`.
- Toute action irréversible demande confirmation ; une action annulable propose « Annuler » dans la notification.

## À chaque nouvelle fonction
- Mettre à jour l'aide intégrée (`AIDE` dans `index.html`).
- Tester : lancement avec `CAPTURE=… SCRIPT=…`, regarder la capture, vérifier la syntaxe
  (`node --check`), retirer les crochets de test (`// TEST`) avant le commit.

## Publication
- Commit en français décrivant le changement pour l'utilisateur.
- `git push` → GitHub Actions fabrique le Flatpak (version 1.0.<build>) → Release → FlatKein.
- Puis : `gh workflow run publier -R Jeff12873/FlatKein`, `flatpak update --user <id>`, relancer l'appli,
  et confirmer à l'utilisateur la version installée.
