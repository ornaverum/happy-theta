/* GIF Maker page — turn a set of images into an animated GIF */
'use strict';

(function () {
	const { el } = HT;

	const GIF_WIDTH = 500;

	let selectedFiles = []; // File[]
	let objectURLs = [];
	let selectedIndex = 0;
	let frameDelay = 1;
	let gifTitle = 'My GIF';
	let loading = false;

	/* ---------- DOM ---------- */
	const mainView = el('div', { class: 'main-view' });
	const thumbs = el('div', { class: 'thumbs' });
	const fileInput = el('input', { id: 'image_files', class: 'file-input', type: 'file', multiple: true, accept: '.jpg, .jpeg, .heic, .png' });
	const helper = el('p', { class: 'helper' });
	const sliderLabel = el('label', { for: 'slider' });
	const slider = el('input', { type: 'range', id: 'slider', min: '0.1', max: '1', step: '0.1', value: String(frameDelay) });
	const titleInput = el('input', { id: 'gifTitle', type: 'text', value: gifTitle });
	const preview = el('div', { id: 'gif-preview' });
	const loadingNote = el('div', { text: 'Loading...' });

	const makeBtn = el('button', { type: 'button', class: 'btn btn-plain-blue', text: 'Create GIF from Images' });
	const saveBtn = el('button', { type: 'button', class: 'btn btn-plain-blue', text: 'Save Gif' });
	const resetBtn = el('button', { type: 'button', class: 'btn btn-plain-red', text: 'Reset' });

	const page = el(
		'div',
		null,
		el(
			'div',
			{ id: 'gif', class: 'gif-box' },
			el('div', { class: 'gif-title', text: 'GIF Maker' }),
			el('div', { class: 'gif-view' }, mainView, thumbs),
			el(
				'div',
				{ class: 'gif-form' },
				el('label', { class: 'upload-label', for: 'image_files', text: 'Upload image files' }),
				fileInput,
				helper,
				sliderLabel,
				el('br'),
				slider,
				el('div', { class: 'title-row' }, el('label', { for: 'gifTitle', text: 'GIF Title:' }), titleInput),
				preview,
				el('div', { class: 'gif-buttons' }, makeBtn, saveBtn, resetBtn)
			)
		)
	);
	document.querySelector('.content').appendChild(page);

	/* ---------- rendering ---------- */
	function setFiles(files) {
		objectURLs.forEach((u) => URL.revokeObjectURL(u));
		selectedFiles = files;
		objectURLs = files.map((f) => URL.createObjectURL(f));
		if (selectedIndex >= files.length) selectedIndex = 0;
		render();
	}

	function render() {
		const has = selectedFiles.length > 0;

		mainView.replaceChildren(
			has
				? el('img', { src: objectURLs[selectedIndex], alt: '' })
				: el('div', { class: 'no-image', text: 'No image selected' })
		);

		thumbs.replaceChildren();
		if (selectedFiles.length > 1) {
			thumbs.appendChild(el('div', { class: 'thumbs-title', text: 'Select Image:' }));
			selectedFiles.forEach((file, i) => {
				thumbs.appendChild(
					el(
						'div',
						{ class: 'thumb' },
						el(
							'div',
							{
								class: 'pick' + (i === selectedIndex ? ' selected' : ''),
								onclick: () => {
									selectedIndex = i;
									render();
								}
							},
							el('img', { src: objectURLs[i], alt: 'Selected Image' })
						),
						el('div', { class: 'remove' }, el('button', { type: 'button', text: 'X', onclick: () => removeFile(i) }))
					)
				);
			});
		}

		helper.textContent = 'Selected files: ' + (has ? selectedFiles.map((f) => f.name).join(', ') : 'No files selected');
		sliderLabel.textContent = 'Select frame duration (seconds): ' + frameDelay;
		makeBtn.disabled = !has;
		saveBtn.disabled = !has;
		if (loading) preview.prepend(loadingNote);
		else loadingNote.remove();
	}

	function removeFile(i) {
		const copy = [...selectedFiles];
		copy.splice(i, 1);
		setFiles(copy);
	}

	/* ---------- GIF creation ---------- */
	function loadImage(src) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('Could not decode image'));
			img.src = src;
		});
	}

	const nextFrame = () => new Promise((r) => setTimeout(r, 0));

	async function handleMakeGif() {
		if (!selectedFiles.length) {
			console.error('No files selected!');
			return;
		}
		loading = true;
		render();
		await nextFrame();
		try {
			const images = await Promise.all(objectURLs.map(loadImage));
			const first = images[0];
			const w = GIF_WIDTH;
			const h = Math.max(1, Math.round((first.naturalHeight / first.naturalWidth) * GIF_WIDTH));

			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext('2d', { willReadFrequently: true });

			const frames = [];
			for (const img of images) {
				ctx.clearRect(0, 0, w, h);
				ctx.drawImage(img, 0, 0, w, h);
				if (gifTitle) {
					ctx.font = 'bold 24px sans-serif';
					ctx.fillStyle = '#ff9922';
					ctx.textAlign = 'right';
					ctx.textBaseline = 'bottom';
					ctx.fillText(gifTitle, w, h);
				}
				frames.push(ctx.getImageData(0, 0, w, h));
				await nextFrame();
			}

			const bytes = HT.encodeGIF(frames, { delay: Math.round(frameDelay * 100), loop: 0 });
			const blob = new Blob([bytes], { type: 'image/gif' });
			const url = URL.createObjectURL(blob);
			preview.appendChild(el('img', { src: url }));
		} catch (err) {
			console.error('Error making GIF:', err);
		}
		loading = false;
		render();
	}

	function saveGif() {
		const img = preview.querySelector('img');
		if (!img) {
			console.error('No GIF image found to save.');
			return;
		}
		const link = document.createElement('a');
		link.href = img.src;
		link.download = 'generated.gif';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function clearAll() {
		fileInput.value = '';
		selectedIndex = 0;
		preview.querySelectorAll('img').forEach((img) => URL.revokeObjectURL(img.src));
		preview.replaceChildren();
		setFiles([]);
	}

	/* ---------- events ---------- */
	fileInput.addEventListener('change', () => setFiles(Array.from(fileInput.files || [])));
	slider.addEventListener('input', () => {
		frameDelay = Number(slider.value);
		render();
	});
	titleInput.addEventListener('input', () => (gifTitle = titleInput.value));
	makeBtn.addEventListener('click', handleMakeGif);
	saveBtn.addEventListener('click', saveGif);
	resetBtn.addEventListener('click', clearAll);

	render();
})();
