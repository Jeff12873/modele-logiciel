// Pont entre l'interface et le processus principal : la liste FERMÉE des actions permises,
// exposée sous window.appli. L'interface n'a aucun autre accès au système.
// Sans ce pont (page ouverte dans un navigateur), l'interface fonctionne en mode autonome
// (données dans le navigateur) : c'est ce qui la rend transposable en appli web.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appli', {
  config: () => ipcRenderer.invoke('config'),
  choisirCoffre: () => ipcRenderer.invoke('choisir-coffre'),
  lireDonnees: () => ipcRenderer.invoke('lire-donnees'),
  ecrireDonnees: (donnees) => ipcRenderer.invoke('ecrire-donnees', donnees),
  lireNotes: (dossier) => ipcRenderer.invoke('lire-notes', dossier),
  changerPropriete: (relatif, cle, valeur, mtime) => ipcRenderer.invoke('changer-propriete', relatif, cle, valeur, mtime),
  verifierMaj: () => ipcRenderer.invoke('verifier-maj'),
  ouvrirLien: (url) => ipcRenderer.invoke('ouvrir-lien', url),
  surDonneesChangees: (fn) => ipcRenderer.on('donnees-changees', () => fn()),
});
