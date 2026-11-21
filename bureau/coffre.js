// Lecture et écriture dans un coffre Obsidian (ou tout dossier de fichiers texte de l'utilisateur).
//
// Principes :
//  - les données appartiennent à l'utilisateur : ce sont ses fichiers, lisibles sans l'application ;
//  - on n'écrit jamais un fichier à moitié (écriture atomique), car le coffre est souvent synchronisé ;
//  - on ne réécrit que la ligne modifiée du frontmatter, pour ne rien abîmer d'autre ;
//  - on refuse d'écrire si le fichier a changé ailleurs depuis qu'on l'a lu (mtime) ;
//  - on ne sort jamais du coffre (chemins vérifiés).

const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');

// Vrai si le dossier est un coffre Obsidian
const estCoffre = (dossier) => fs.existsSync(path.join(dossier, '.obsidian'));

// Chemin d'un fichier à l'intérieur du coffre ; lève une erreur s'il en sortirait
function cheminDans(coffre, relatif) {
  if (!coffre) throw new Error('Aucun coffre choisi.');
  const f = path.normalize(path.join(coffre, String(relatif || '')));
  if (!f.startsWith(path.normalize(coffre) + path.sep)) throw new Error('Chemin hors du coffre refusé.');
  return f;
}

// Écriture « atomique » : fichier temporaire puis renommage
async function ecrireAtomique(chemin, contenu) {
  await fsp.mkdir(path.dirname(chemin), { recursive: true });
  const temporaire = path.join(path.dirname(chemin), `.${path.basename(chemin)}.tmp`);
  await fsp.writeFile(temporaire, contenu);
  await fsp.rename(temporaire, chemin);
}

// Lit un fichier en vérifiant qu'il n'a pas changé depuis la dernière lecture (mtime en ms)
async function lireVerifie(chemin, mtimeAttendu) {
  const info = await fsp.stat(chemin);
  if (mtimeAttendu && Math.abs(info.mtimeMs - mtimeAttendu) > 1) {
    const e = new Error('Le fichier a été modifié ailleurs entre-temps : recharge et réessaie.');
    e.modifie = true; throw e;
  }
  return { texte: await fsp.readFile(chemin, 'utf8'), mtime: info.mtimeMs };
}

// --- Frontmatter YAML : lecture simple et modification ligne à ligne -------------------------

const RE_FM = /^---\r?\n([\s\S]*?)\r?\n---/;

// Lit les clés simples et les listes du frontmatter (suffisant pour les propriétés Obsidian courantes)
function lireFrontmatter(texte) {
  const m = texte.match(RE_FM); if (!m) return {};
  const o = {}; let cle = null;
  for (const ligne of m[1].split(/\r?\n/)) {
    const kv = ligne.match(/^([^\s#-][^:]*):\s*(.*)$/);
    if (kv) {
      cle = kv[1].trim(); const v = kv[2].trim();
      o[cle] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : v.replace(/^["']|["']$/g, '');
      continue;
    }
    const li = ligne.match(/^\s+-\s+(.*)$/);
    if (li && cle) { if (!Array.isArray(o[cle])) o[cle] = []; o[cle].push(li[1].trim().replace(/^["']|["']$/g, '')); }
  }
  return o;
}

// Remplace (ou ajoute, ou supprime si valeur == null) une clé du frontmatter, sans toucher au reste
function changerCle(texte, cle, valeur) {
  const m = texte.match(RE_FM);
  if (!m) return valeur == null ? texte : `---\n${cle}: ${valeur}\n---\n${texte}`;
  const lignes = m[1].split(/\r?\n/);
  const i = lignes.findIndex(l => l.startsWith(cle + ':'));
  if (i >= 0) {
    let j = i + 1;
    while (j < lignes.length && /^\s+\S/.test(lignes[j])) j++;   // valeurs en liste ou indentées
    lignes.splice(i, j - i, ...(valeur == null ? [] : [`${cle}: ${valeur}`]));
  } else if (valeur != null) {
    lignes.push(`${cle}: ${valeur}`);
  }
  return texte.replace(m[0], '---\n' + lignes.join('\n') + '\n---');
}

// Liste les notes Markdown d'un dossier du coffre : [{nom, texte, mtime}]
async function lireNotes(coffre, dossier) {
  const d = cheminDans(coffre, dossier);
  let noms = [];
  try { noms = (await fsp.readdir(d)).filter(n => n.endsWith('.md')); } catch { return []; }
  return Promise.all(noms.map(async nom => {
    const f = path.join(d, nom), info = await fsp.stat(f);
    return { nom, texte: await fsp.readFile(f, 'utf8'), mtime: info.mtimeMs };
  }));
}

module.exports = { estCoffre, cheminDans, ecrireAtomique, lireVerifie, lireFrontmatter, changerCle, lireNotes };
