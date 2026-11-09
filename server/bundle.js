'use strict';
/* Backup files ("Export all my work"). The browser side is in shared/gate.js (HTGate.exportAll / importFiles);
   keep the two in step.

   {
     format: 'happytheta-backup', version: 1, exported: ISO date, who: email or 'guest', from: 'browser' | 'server',
     docs:   [ the usual save envelopes: {format:'happytheta', tool, id, meta, data, view} ],
     assets: { 'marks:<docId>': {<assetId>: {id, name, mime, data: 'data:…'}}, 'mindmap:<docId>': {…} }
   }
   assets = pictures in Theta Marks and attachments in Theta Maps, which live in the browser (IndexedDB),
   never on the server. read() also accepts a single tool file (name.fbd.json, name.mindmap.json …),
   whose own data.assets are moved into `assets`. */
const crypto = require('crypto');

const TOOLS = ['fbd', 'energy', 'motion', 'graph', 'scheduler', 'schedtemplate', 'mindmap', 'marks'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const newId = () => 's_' + crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8).toLowerCase();

function make(docs, { who = 'guest', from = 'server', assets = {} } = {}) {
	return { format: 'happytheta-backup', version: 1, exported: new Date().toISOString(), who, from, docs, assets };
}

function cleanDoc(d) {
	if (!d || typeof d !== 'object' || d.format !== 'happytheta' || !TOOLS.includes(d.tool) || !d.data || typeof d.data !== 'object') return null;
	const doc = { ...d, meta: d.meta && typeof d.meta === 'object' ? d.meta : {}, view: d.view && typeof d.view === 'object' ? d.view : {} };
	if (!ID_RE.test(String(doc.id || ''))) doc.id = newId();
	return doc;
}

/* → {docs, assets, assetCount, ignored}. Throws a readable Error for files that aren't ours. */
function read(text) {
	let f;
	try {
		f = typeof text === 'string' ? JSON.parse(text) : text;
	} catch {
		throw new Error('That file is not valid JSON.');
	}
	const raw = f && f.format === 'happytheta-backup' ? f.docs || [] : f && f.format === 'happytheta' ? [f] : null;
	if (!raw) throw new Error('That is not a Happy Theta backup or save file.');
	const assets = {};
	for (const [k, v] of Object.entries((f.format === 'happytheta-backup' && f.assets) || {})) if (v && typeof v === 'object') assets[k] = v;
	const docs = [];
	let ignored = 0;
	for (const d of raw) {
		const doc = cleanDoc(d);
		if (!doc) {
			ignored++;
			continue;
		}
		// A tool's own export file (Theta Maps / Marks) carries its pictures inside data.assets.
		if (doc.data.assets && typeof doc.data.assets === 'object') {
			const { assets: inner, ...rest } = doc.data;
			assets[doc.tool + ':' + doc.id] = { ...(assets[doc.tool + ':' + doc.id] || {}), ...inner };
			doc.data = rest;
		}
		docs.push(doc);
	}
	const assetCount = Object.values(assets).reduce((n, a) => n + Object.keys(a).length, 0);
	return { docs, assets, assetCount, ignored };
}

module.exports = { make, read, newId, TOOLS };
