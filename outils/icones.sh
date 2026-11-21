#!/bin/sh
# Régénère les icônes PNG (512, 128, 64 px) à partir de icone.svg. Nécessite rsvg-convert (librsvg).
set -e
rsvg-convert -w 512 -h 512 icone.svg -o bureau/icone.png
rsvg-convert -w 128 -h 128 icone.svg -o bureau/flatpak/icone-128.png
rsvg-convert -w 64 -h 64 icone.svg -o bureau/flatpak/icone-64.png
echo "Icônes régénérées."
