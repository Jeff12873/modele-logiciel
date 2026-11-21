// Processus principal (Electron) : la seule partie qui touche au système.
// Elle ouvre la fenêtre, sert l'interface (index.html) par le protocole app://, garde la configuration
// propre à l'ordinateur, et expose à l'interface une liste fermée d'actions (voir preload.js).
//
// Rien de personnel dans l'application ni dans le dépôt : la configuration vit dans le dossier de
// l'utilisateur (~/.config/<Nom>), les données dans ses propres fichiers (coffre Obsidian).

const { app, BrowserWindow, protocol, net, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const coffre = require('./coffre');
const PAQUET = require('../package.json');

const NOM = PAQUET.productName;
const SCHEMA = PAQUET.name;                                   // app://<nom>/index.html
const RACINE = path.join(__dirname, '..');
const FICHIER_CONFIG = () => path.join(app.getPath('userData'), 'config.json');
// Liste des versions publiées par le dépôt Flatpak (une ligne « dépôt vX.Y.Z » par application)
const URL_VERSIONS = 'https://jeff12873.github.io/FlatKein/versions.txt';

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

// --- Configuration propre à cet ordinateur (chemins, jetons) ------------------------------

let config = { coffre: null, donnees: `${NOM}.json` };
function chargerConfig() {
  try { config = { ...config, ...JSON.parse(fs.readFileSync(FICHIER_CONFIG(), 'utf8')) }; } catch { /* premier lancement */ }
}
async function enregistrerConfig() { await coffre.ecrireAtomique(FICHIER_CONFIG(), JSON.stringify(config, null, 2)); }

// Secrets ajoutés au build (GitHub Actions → bureau/secrets.json), jamais dans le dépôt
const SECRETS = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets.json'), 'utf8')); } catch { return {}; } })();

// --- Actions offertes à l'interface (IPC) --------------------------------------------------

ipcMain.handle('config', () => ({ coffre: config.coffre, nomCoffre: config.coffre ? path.basename(config.coffre) : null, donnees: config.donnees, version: app.getVersion(), nom: NOM }));

ipcMain.handle('choisir-coffre', async (evenement) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(evenement.sender), {
    title: 'Choisir le dossier du coffre Obsidian', properties: ['openDirectory'], defaultPath: config.coffre || app.getPath('home'),
  });
  if (canceled || !filePaths[0]) return null;
  if (!coffre.estCoffre(filePaths[0])) throw new Error("Ce dossier n'est pas un coffre Obsidian (pas de dossier .obsidian).");
  config.coffre = filePaths[0]; await enregistrerConfig(); surveiller();
  return config.coffre;
});

// Données de l'application : un fichier JSON dans le coffre (synchronisé entre les ordinateurs)
const fichierDonnees = () => { const f = coffre.cheminDans(config.coffre, config.donnees); if (!f.endsWith('.json')) throw new Error('Fichier de données invalide.'); return f; };
let dernierEcrit = 0;
ipcMain.handle('lire-donnees', async () => { try { return JSON.parse(await fsp.readFile(fichierDonnees(), 'utf8')); } catch { return null; } });
ipcMain.handle('ecrire-donnees', async (evenement, donnees) => {
  dernierEcrit = Date.now();
  await coffre.ecrireAtomique(fichierDonnees(), JSON.stringify({ format: `${SCHEMA}/1`, ...donnees }, null, 2));
  return true;
});

// Notes d'un dossier du coffre, avec leur frontmatter
ipcMain.handle('lire-notes', async (evenement, dossier) =>
  (await coffre.lireNotes(config.coffre, dossier)).map(n => ({ ...n, proprietes: coffre.lireFrontmatter(n.texte) })));

// Modifier une propriété d'une note, seulement si elle n'a pas changé ailleurs entre-temps
ipcMain.handle('changer-propriete', async (evenement, relatif, cle, valeur, mtime) => {
  if (!/^[\w .-]+$/.test(String(cle))) throw new Error('Nom de propriété invalide.');
  const chemin = coffre.cheminDans(config.coffre, relatif);
  const { texte } = await coffre.lireVerifie(chemin, mtime);
  await coffre.ecrireAtomique(chemin, coffre.changerCle(texte, cle, valeur == null ? null : String(valeur).replace(/\n/g, ' ')));
  return true;
});

// Vérification des mises à jour : compare la version installée à la dernière publiée
const nums = (v) => String(v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
const plusRecente = (a, b) => { const x = nums(a), y = nums(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return false; };
ipcMain.handle('verifier-maj', async () => {
  const actuelle = app.getVersion();
  if (!app.isPackaged && !process.env.FAUSSE_MAJ) return { actuelle, derniere: actuelle, nouvelle: false };
  try {
    const r = await net.fetch(URL_VERSIONS, { cache: 'no-store' });
    if (!r.ok) return { actuelle, erreur: `HTTP ${r.status}` };
    const l = (await r.text()).split('\n').find(x => x.startsWith(PAQUET.flatpak.depot + ' '));
    const derniere = process.env.FAUSSE_MAJ || (l ? l.split(' ')[1].replace(/^v/, '') : actuelle);
    return { actuelle, derniere, nouvelle: plusRecente(derniere, actuelle), commande: `flatpak update --user ${PAQUET.flatpak.id}` };
  } catch (e) { return { actuelle, erreur: e.message }; }
});

ipcMain.handle('ouvrir-lien', (evenement, url) => { if (/^(https|obsidian):\/\//.test(String(url))) shell.openExternal(url); });

// --- Suivi en direct : prévient l'interface quand le fichier de données change ailleurs -----

let veilleur = null, minuterie = null;
function surveiller() {
  if (veilleur) veilleur.close(); veilleur = null;
  if (!config.coffre) return;
  try {
    const f = fichierDonnees();
    veilleur = fs.watch(path.dirname(f), (type, nom) => {
      if (nom !== path.basename(f) || Date.now() - dernierEcrit < 1500) return;
      clearTimeout(minuterie); minuterie = setTimeout(() => BrowserWindow.getAllWindows().forEach(w => w.webContents.send('donnees-changees')), 250);
    });
  } catch { /* dossier absent */ }
}

// --- Fenêtre ----------------------------------------------------------------------------

function servirFichiers() {
  protocol.handle('app', requete => {
    const fichier = path.normalize(path.join(RACINE, decodeURIComponent(new URL(requete.url).pathname)));
    if (!fichier.startsWith(RACINE + path.sep)) return new Response('Interdit', { status: 403 });
    return net.fetch(pathToFileURL(fichier).toString());
  });
}

function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 1280, height: 820, minWidth: 800, minHeight: 520, title: NOM,
    icon: path.join(__dirname, 'icone.png'), backgroundColor: '#FAFAF7', autoHideMenuBar: true,
    show: !process.env.CAPTURE,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  // Liens externes : dans le navigateur, jamais dans la fenêtre de l'application
  fenetre.webContents.setWindowOpenHandler(({ url }) => { if (/^(https|obsidian):\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  fenetre.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(`app://${SCHEMA}/`)) { e.preventDefault(); if (/^(https|obsidian):\/\//.test(url)) shell.openExternal(url); } });
  fenetre.loadURL(`app://${SCHEMA}/index.html`);
  if (process.env.CAPTURE) capturer(fenetre, process.env.CAPTURE);
}

// Tests : CAPTURE=/chemin/ecran.png [SCRIPT=/chemin/test.js] → exécute le script dans la page,
// affiche son résultat, enregistre une capture puis quitte.
function capturer(fenetre, sortie) {
  fenetre.webContents.on('console-message', ({ level, message }) => console.log(`[console:${level}] ${message}`));
  fenetre.webContents.on('did-finish-load', () => setTimeout(async () => {
    if (process.env.SCRIPT) {
      try { console.log('[script]', JSON.stringify(await fenetre.webContents.executeJavaScript(fs.readFileSync(process.env.SCRIPT, 'utf8')))); }
      catch (e) { console.log('[script] erreur', e.message); }
      await new Promise(r => setTimeout(r, 800));
    }
    await fsp.writeFile(sortie, (await fenetre.webContents.capturePage()).toPNG());
    console.log(`Capture : ${sortie}`); app.quit();
  }, 1500));
}

app.setName(NOM);
app.whenReady().then(() => { chargerConfig(); servirFichiers(); creerFenetre(); surveiller(); });
app.on('window-all-closed', () => app.quit());
