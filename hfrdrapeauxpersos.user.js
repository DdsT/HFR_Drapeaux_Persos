// ==UserScript==
// @name        [HFR] Drapeaux Persos
// @namespace   ddst.github.io
// @version     1.0.1
// @author      DdsT
// @downloadURL https://ddst.github.io/HFR_Drapeaux_Persos/hfrdrapeauxpersos.user.js
// @updateURL   https://ddst.github.io/HFR_Drapeaux_Persos/hfrdrapeauxpersos.meta.js
// @supportURL  https://ddst.github.io/HFR_Drapeaux_Persos/
// @description Renommer les sujets dans les pages des drapeaux et des favoris
// @icon        https://www.hardware.fr/images_skin_2010/facebook/logo.png
// @match       *://forum.hardware.fr/forum1.php*
// @match       *://forum.hardware.fr/forum1f.php*
// @match       *://forum.hardware.fr/hfr/*/liste_sujet-*.htm
// @require     https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @grant       GM.getValue
// @grant       GM.setValue
// ==/UserScript==

/*
Copyright (C) 2020 DdsT

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see https://ddst.github.io/hfr_ColorTag/LICENSE.
*/

/* v1.0.1
 * ------
 * - Modification de la fonction d'import pour la compatibilité avec Firefox
 * - Correction de la vérification d'intégrité de la BDD importée
 */

/*** Paramètres du script ***/

const CONFIG = {
  allowHTML : true, // autoriser les balises HTML dans le titre des sujets
  clickBox  : 1,    // indice de la case cliquable
}

/*** Fin des paramètres ***/

const STYLE = `
.dp-input {
  border      : none;
  outline     : none;
  width       : 100%;
  padding     : 2px 0;
  font-family : Verdana,Arial,Sans-serif,Helvetica;
  font-size   : small;
  font-style  : italic;
}

.sujetCase${CONFIG.clickBox} {
  cursor : pointer;
}

.dp-hide {
  display : none;
}

.dp-italic {
  font-style : italic;
}
`;

const VERSION = GM.info.script.version;
const ROOT = document.getElementById("mesdiscussions");
const ISFLAGPAGE =  (new URL(document.location)).searchParams.get("owntopic")>0;
const DEFAULTSTRING =`{"version":"${VERSION}","date":${Date.now()},"topicTable":{}}`;
const CAT = {
  "Hardware"                   : 1,
  "HardwarePeripheriques"      : 16,
  "OrdinateursPortables"       : 15,
  "OverclockingCoolingModding" : 2,
  "electroniquedomotiquediy"   : 30,
  "gsmgpspda"                  : 23,
  "apple"                      : 25,
  "VideoSon"                   : 3,
  "Photonumerique"             : 14,
  "JeuxVideo"                  : 5,
  "WindowsSoftware"            : 4,
  "reseauxpersosoho"           : 22,
  "systemereseauxpro"          : 21,
  "OSAlternatifs"              : 11,
  "Programmation"              : 10,
  "Graphisme"                  : 12,
  "AchatsVentes"               : 6,
  "EmploiEtudes"               : 8,
  "Discussions"                : 13
};

/* Base de données contenant les sujets renommés */
let db = {
  version    : VERSION,
  date       : 0,
  topicTable : {},
  async load() {
    const string = await GM.getValue("storage", DEFAULTSTRING);
    const storage = JSON.parse(string);
    this.version    = storage.version;
    this.date       = storage.date;
    this.topicTable = storage.topicTable;
  },
  save() {
    let storage = {};
    storage.version    = this.version;
    storage.date       = Date.now();
    storage.topicTable = this.topicTable;
    GM.setValue("storage", JSON.stringify(storage));
  },
  add(topic) {
    this.topicTable[topic.id] = [input.value];
    this.save();
  },
  delete(topic) {
    delete this.topicTable[topic.id];
    this.save();
  }
};

// Ensemble des sujets de la page ayant été renommés
let changedTopics = new Set();

/* Champ de saisie pour renommer les sujets, commun à tous les sujets */
let input = document.createElement("input");
input.className = "dp-input dp-hide";
input.active = false;
input.show = function() {
  input.topic.titleBox.appendChild(input);
  input.active = true;
  input.topic.link.classList.toggle("dp-hide");
  input.classList.toggle("dp-hide");
  for (const topic of changedTopics) {
    topic.link.classList.add("dp-italic");
  }
  input.placeholder = input.topic.title;
  input.value = input.topic.newTitle;
  input.focus();
}
input.hide = function() {
  input.active = false;
  input.topic.link.classList.toggle("dp-hide");
  input.classList.toggle("dp-hide");
  for (const topic of changedTopics) {
    topic.link.classList.remove("dp-italic");
  }
}
input.toggle = function() {
  if (input.active) {
    input.hide();
    input.topic.save();
    if (input.topic.id != this.topic.id) {
      input.topic = this.topic;
      input.show();
    }
  } else {
    input.topic = this.topic;
    input.show();
  }
}
input.onkeyup = (event) => {
  if (event.keyCode == 13) input.toggle(); // enter
  if (event.keyCode == 27) input.hide();   // escape
};

/* Un objet Topic est caractérisé par une ligne du tableau des sujets */
class Topic {
  constructor(row) {
    this.row      = row;
    this.clickBox = row.querySelector(`.sujetCase${CONFIG.clickBox}`);
    this.titleBox = row.querySelector(".sujetCase3");
    this.link     = row.querySelector(".sujetCase3>.cCatTopic");
    this.title    = this.link.textContent;
    this.newTitle = "";
    if (ISFLAGPAGE) {
      // La page est une page de drapeaux ou de favoris
      this.cat  = this.link.href.match(/&cat=(\d+)&/)[1];
      this.post = this.link.href.match(/&post=(\d+)&/)[1]; 
    } else {
      this.cat  = CAT[this.link.href.match(/hfr\/(\w+)\//)[1]];
      this.post = this.link.href.match(/-sujet_(\d+)_/)[1];  
    }
    this.id = `${this.cat}-${this.post}`;
    this.row.topic        = this;
    this.clickBox.topic   = this;
    this.clickBox.onclick = input.toggle;
  }
  load() {
    let newTitle = db.topicTable[this.id];
    if (newTitle) {
      // La base de données contient le sujet
      this.newTitle = newTitle[0];
      if (CONFIG.allowHTML) {
        this.link.innerHTML = this.newTitle;
      } else {
        this.link.innerText = this.newTitle;
      }
      this.link.title = this.title;
      changedTopics.add(this);
    } else {
      this.newTitle = "";
      if (CONFIG.allowHTML) {
        this.link.innerHTML = this.title;
      } else {
        this.link.innerText = this.title;
      }
      this.link.title = `Sujet n°${this.post}`;
      changedTopics.delete(this);
    }
  }
  save() {
    if (input.value) { 
      // Le champ de saisi contient un nouveau titre
      db.add(this);
    } else {
      db.delete(this);
    }
    this.load();
  }
}

/* Mettre à jour l'affichage des topics */
function refresh(node) {
  for (const row of node.querySelectorAll(".sujet")) {
    row.topic.load();
  }
}

/* Importer une base de données depuis un fichier JSON */
function importDB() {
  let o = document.getElementById("dp-import") || document.createElement("input");
  o.id = "dp-import";
  o.type = "file";
  o.accept = ".json";
  o.style.display = "";
  o.onchange = function(event) {
    let reader = new FileReader();
    reader.onload = function() {
      try {
        let importedDB = JSON.parse(this.result);
        check(importedDB);
        db.version    = importedDB.version;
        db.date       = importedDB.date;
        db.topicTable = {...importedDB.topicTable};
        db.save();
        refresh(ROOT);
      } catch (err) {
        let message = (typeof err == "string") ? err : "le fichier n'est pas valide.";
        alert("Échec de l'import : " + message);
      }
    };
    reader.readAsText(event.target.files[0]);
    this.value = null; // permet de recharger le même fichier
    o.style.display = "none";
  };
  ROOT.appendChild(o);
  o.click();
}

/* Vérifier si une base de données importée est valide */
function check(importedDB) {
  try {
    let keyOK = ("version" in importedDB) &&
        ("date" in importedDB) &&
        ("topicTable" in importedDB);
    if (!keyOK) throw "la base de données ne contient pas les bons paramètres.";
    if (importedDB.version > VERSION) throw "le script est plus vieux que la base de données";
    for (const id in importedDB.topicTable) {
      if (!importedDB.topicTable[id][0]) throw "liste des topics non valide.";
    }
  } catch (err) {
    throw err;
  }
}

/* Exporter la base de données actuelle sous forme de JSON */
function exportDB() {
  let d = new Date();
  let o = document.getElementById("dp-download") || document.createElement("a");
  const today = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const data  = `text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(db, null, "\t"))}`;
  o.id = "dp-download";
  o.href = `data:${data}`;
  o.download = `${today}_drapeaux_persos.json`;
  ROOT.appendChild(o);
  o.click();
}

/* Rendre chacun des sujets interactif */
function decorate(node) {
  for (const row of node.querySelectorAll(".sujet")) {
    let topic = new Topic(row);
    topic.load();
  }
}

/* Lancer le script */
async function initialize() {
  await db.load();
  GM.addStyle(STYLE);
  GM_registerMenuCommand("Drapeaux Persos : importer une BDD", importDB);
  GM_registerMenuCommand("Drapeaux Persos : exporter la BDD", exportDB);
  decorate(ROOT);
}

initialize();
