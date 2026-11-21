#!/bin/sh
# Donne son nom à une nouvelle application créée depuis le modèle.
#
#   sh outils/renommer.sh "Enveloppes" fr.enveloppes.Enveloppes
#
# Remplace MonAppli / monappli / fr.monappli.MonAppli partout (fichiers et noms de fichiers).
# Le nom du dépôt GitHub devient Jeff12873/<nom en minuscules>.

set -e
[ $# -eq 2 ] || { echo 'Usage : sh outils/renommer.sh "NomAffiché" domaine.inverse.NomApp'; exit 1; }
NOM="$1"; ID="$2"
BIN=$(printf '%s' "$NOM" | iconv -f utf-8 -t ascii//TRANSLIT | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9-')
echo "Nom : $NOM · identifiant : $ID · binaire et dépôt : $BIN"

for f in $(git ls-files | grep -v -e '\.png$' -e 'outils/renommer.sh'); do
  sed -i -e "s/fr\.monappli\.MonAppli/$ID/g" -e "s/MonAppli/$NOM/g" -e "s/monappli/$BIN/g" "$f"
done
git mv "bureau/flatpak/fr.monappli.MonAppli.desktop" "bureau/flatpak/$ID.desktop"
git mv "bureau/flatpak/fr.monappli.MonAppli.metainfo.xml" "bureau/flatpak/$ID.metainfo.xml"
echo "Fait. Pense à : icône (icone.svg puis outils/icones.sh), description (package.json, .desktop, metainfo), aide (index.html)."
