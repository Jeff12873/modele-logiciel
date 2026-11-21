#!/bin/sh
# Fabrique le Flatpak de l'application et l'installe pour l'utilisateur courant.
# Le nom, l'identifiant et le binaire sont lus dans package.json : rien à changer ici.
#
#   sh outils/flatpak.sh              → fabrique et installe
#   PUBLIER=1 sh outils/flatpak.sh    → fabrique <Nom>.flatpak sans l'installer (GitHub Actions)
#
# Prérequis (une seule fois) :
#   flatpak install --user flathub org.electronjs.Electron2.BaseApp//25.08
#   npm install

set -e

ID=$(node -p "require('./package.json').flatpak.id")
NOM=$(node -p "require('./package.json').productName")
BINAIRE=$(node -p "require('./package.json').name")
VERSION_BASE=25.08
CONSTRUCTION=dist/flatpak/construction
DEPOT=dist/flatpak/depot

echo "1/5  Application de bureau"
npx electron-builder --linux dir > /dev/null

echo "2/5  Dossier Flatpak"
rm -rf "$CONSTRUCTION"
flatpak build-init --base=org.electronjs.Electron2.BaseApp --base-version=$VERSION_BASE \
  "$CONSTRUCTION" "$ID" org.freedesktop.Platform org.freedesktop.Platform $VERSION_BASE

FICHIERS="$CONSTRUCTION/files"
# Fiche AppStream avec la version du package.json (montée à chaque publication) : Warehouse la voit
VERSION_APP=$(node -p "require('./package.json').version")
METAINFO=dist/flatpak/$ID.metainfo.xml
mkdir -p dist/flatpak
sed "s|<release version=\"[^\"]*\" date=\"[^\"]*\"/>|<release version=\"$VERSION_APP\" date=\"$(date +%F)\"/>|" bureau/flatpak/$ID.metainfo.xml > "$METAINFO"
mkdir -p "$FICHIERS/bin" "$FICHIERS/share/applications" "$FICHIERS/share/metainfo" "$FICHIERS/share/icons/hicolor/512x512/apps"
cp -r dist/linux-unpacked "$FICHIERS/$BINAIRE"
rm -f "$FICHIERS/$BINAIRE/chrome-sandbox"          # inutile : zypak s'en charge
install -m 755 bureau/flatpak/lanceur.sh "$FICHIERS/bin/$BINAIRE"
install -m 644 bureau/flatpak/$ID.desktop "$FICHIERS/share/applications/"
install -m 644 "$METAINFO" "$FICHIERS/share/metainfo/$ID.metainfo.xml"
install -m 644 bureau/icone.png "$FICHIERS/share/icons/hicolor/512x512/apps/$ID.png"

# Catalogue AppStream : sans lui, l'application est invisible dans Warehouse et Discover
mkdir -p "$FICHIERS/share/app-info/xmls"
for TAILLE in 64 128; do
  mkdir -p "$FICHIERS/share/app-info/icons/flatpak/${TAILLE}x${TAILLE}"
  install -m 644 bureau/flatpak/icone-$TAILLE.png "$FICHIERS/share/app-info/icons/flatpak/${TAILLE}x${TAILLE}/$ID.png"
done
{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<components version="0.14" origin="flatpak">'
  sed -e '1d' -e "s|</component>|  <icon type=\"cached\" width=\"64\" height=\"64\">$ID.png</icon>\n  <icon type=\"cached\" width=\"128\" height=\"128\">$ID.png</icon>\n  <bundle type=\"flatpak\">app/$ID/x86_64/master</bundle>\n</component>|" "$METAINFO"
  echo '</components>'
} | gzip > "$FICHIERS/share/app-info/xmls/$ID.xml.gz"

echo "3/5  Permissions"
# Ne demander que le nécessaire, et dire pourquoi :
#  réseau : vérification des mises à jour (et services en ligne éventuels) ;
#  dossier personnel : lire et écrire dans le coffre Obsidian, où qu'il soit.
flatpak build-finish "$CONSTRUCTION" \
  --command="$BINAIRE" \
  --socket=wayland --socket=fallback-x11 --share=ipc --share=network --device=dri \
  --filesystem=home \
  --env=ELECTRON_OZONE_PLATFORM_HINT=auto > /dev/null

echo "4/5  Dépôt local et fichier $NOM.flatpak"
rm -rf "$DEPOT"
flatpak build-export "$DEPOT" "$CONSTRUCTION" > /dev/null
flatpak build-bundle "$DEPOT" "$NOM.flatpak" "$ID"

if [ -n "$PUBLIER" ]; then echo "Prêt à publier : $NOM.flatpak"; exit 0; fi

echo "5/5  Installation"
flatpak install --user -y --noninteractive --reinstall "$NOM.flatpak"
echo "Terminé : $NOM est dans le menu des applications et dans Warehouse."
