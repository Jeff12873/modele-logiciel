# Modèle de logiciel

Base pour fabriquer une application de bureau Linux, reliée ou non à un coffre Obsidian,
publiée en Flatpak avec mises à jour automatiques. Tirée de la construction de Cadence.

Ce dépôt est une **coquille vide** : aucune donnée personnelle, aucun secret.

## Démarrer une nouvelle application

1. Sur GitHub : **Use this template → Create a new repository** (ex. `Jeff12873/enveloppes`), puis :

       git clone https://github.com/Jeff12873/enveloppes ~/Projets/enveloppes
       cd ~/Projets/enveloppes
       sh outils/renommer.sh "Enveloppes" fr.enveloppes.Enveloppes
       npm install
       npm run demarrer

2. Remplacer l'icône (`icone.svg`, puis `sh outils/icones.sh`) et les descriptions
   (`package.json`, `bureau/flatpak/*.desktop`, `*.metainfo.xml`).
3. Remplacer l'**exemple** de `index.html` (liste de notes) par le métier de l'application.
4. Publier : ajouter le secret `FLATKEIN_JETON`, ajouter une ligne dans `applications.txt` de
   [FlatKein](https://github.com/Jeff12873/FlatKein), puis `git push`.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'interface : thème, réglages, aide intégrée, notifications, logique métier |
| `bureau/main.js` | Processus principal : fenêtre, protocole `app://`, configuration, actions système |
| `bureau/preload.js` | Pont : la liste fermée des actions que l'interface peut demander (`window.appli`) |
| `bureau/coffre.js` | Lecture/écriture sûres dans le coffre : atomique, frontmatter ligne à ligne, mtime |
| `bureau/flatpak/` | Lanceur, fiche `.desktop`, fiche AppStream `metainfo.xml`, icônes |
| `outils/flatpak.sh` | Fabrique (et installe) le Flatpak ; lit nom et identifiant dans `package.json` |
| `outils/renommer.sh` | Donne son nom à une nouvelle application |
| `outils/icones.sh` | Régénère les PNG depuis `icone.svg` |
| `.github/workflows/flatpak.yml` | À chaque `git push` : version 1.0.N, Flatpak, Release, FlatKein prévenu |
| `CLAUDE.md` | Règles de travail pour Claude Code sur ce projet |

## Tester

    npm run demarrer                                        # lancer
    CAPTURE=/tmp/ecran.png npx electron .                   # capture d'écran puis quitte
    CAPTURE=/tmp/ecran.png SCRIPT=test.js npx electron .    # exécute test.js dans la page avant
    FAUSSE_MAJ=9.9.9 npx electron .                         # simule une mise à jour disponible
    sh outils/flatpak.sh                                    # fabrique et installe le Flatpak
