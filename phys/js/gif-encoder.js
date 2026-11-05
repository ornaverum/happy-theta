/* Minimal animated-GIF encoder: median-cut palette per frame + LZW. No dependencies.
   HT.encodeGIF(frames: ImageData[], { delay: centiseconds, loop: 0 = forever }) -> Uint8Array */
'use strict';

(function () {
	/* ---------- byte writer ---------- */
	class Bytes {
		constructor() {
			this.buf = new Uint8Array(1 << 16);
			this.len = 0;
		}
		grow(n) {
			if (this.len + n <= this.buf.length) return;
			let size = this.buf.length * 2;
			while (size < this.len + n) size *= 2;
			const nb = new Uint8Array(size);
			nb.set(this.buf.subarray(0, this.len));
			this.buf = nb;
		}
		byte(b) {
			this.grow(1);
			this.buf[this.len++] = b & 0xff;
		}
		short(s) {
			this.byte(s);
			this.byte(s >> 8);
		}
		bytes(arr) {
			this.grow(arr.length);
			this.buf.set(arr, this.len);
			this.len += arr.length;
		}
		str(s) {
			for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
		}
		result() {
			return this.buf.slice(0, this.len);
		}
	}

	/* ---------- median-cut quantizer on a 15-bit (5:5:5) histogram ---------- */
	function quantize(rgba, maxColors = 256) {
		const hist = new Uint32Array(32768);
		const n = rgba.length / 4;
		const idx = new Uint16Array(n);
		for (let i = 0, p = 0; i < n; i++, p += 4) {
			const k = ((rgba[p] >> 3) << 10) | ((rgba[p + 1] >> 3) << 5) | (rgba[p + 2] >> 3);
			idx[i] = k;
			hist[k]++;
		}
		const colors = [];
		for (let k = 0; k < 32768; k++) if (hist[k]) colors.push(k);

		const comp = (k, c) => (c === 0 ? (k >> 10) & 31 : c === 1 ? (k >> 5) & 31 : k & 31);
		const makeBox = (list) => {
			let count = 0;
			const lo = [31, 31, 31];
			const hi = [0, 0, 0];
			for (const k of list) {
				count += hist[k];
				for (let c = 0; c < 3; c++) {
					const v = comp(k, c);
					if (v < lo[c]) lo[c] = v;
					if (v > hi[c]) hi[c] = v;
				}
			}
			return { list, count, lo, hi };
		};

		const boxes = [makeBox(colors)];
		while (boxes.length < maxColors) {
			// split the box with the largest (range x population) that can still be split
			let best = -1;
			let bestScore = -1;
			for (let i = 0; i < boxes.length; i++) {
				const b = boxes[i];
				if (b.list.length < 2) continue;
				const range = Math.max(b.hi[0] - b.lo[0], b.hi[1] - b.lo[1], b.hi[2] - b.lo[2]);
				const score = range * b.count;
				if (score > bestScore) {
					bestScore = score;
					best = i;
				}
			}
			if (best < 0) break;
			const b = boxes[best];
			const ranges = [0, 1, 2].map((c) => b.hi[c] - b.lo[c]);
			const axis = ranges.indexOf(Math.max(...ranges));
			b.list.sort((p, q) => comp(p, axis) - comp(q, axis));
			let acc = 0;
			let cut = 1;
			for (let i = 0; i < b.list.length - 1; i++) {
				acc += hist[b.list[i]];
				if (acc >= b.count / 2) {
					cut = i + 1;
					break;
				}
				cut = i + 1;
			}
			boxes.splice(best, 1, makeBox(b.list.slice(0, cut)), makeBox(b.list.slice(cut)));
		}

		const palette = new Uint8Array(256 * 3);
		const lut = new Uint8Array(32768);
		boxes.forEach((b, i) => {
			let r = 0;
			let g = 0;
			let bl = 0;
			for (const k of b.list) {
				const w = hist[k];
				r += (((k >> 10) & 31) * 8 + 4) * w;
				g += (((k >> 5) & 31) * 8 + 4) * w;
				bl += ((k & 31) * 8 + 4) * w;
				lut[k] = i;
			}
			palette[i * 3] = Math.round(r / b.count);
			palette[i * 3 + 1] = Math.round(g / b.count);
			palette[i * 3 + 2] = Math.round(bl / b.count);
		});

		const indices = new Uint8Array(n);
		for (let i = 0; i < n; i++) indices[i] = lut[idx[i]];
		return { palette, indices };
	}

	/* ---------- LZW (GIF variant), output packed into 255-byte sub-blocks ---------- */
	const table = new Int32Array(4096 * 256);

	function lzw(indices, out, minCodeSize = 8) {
		const clear = 1 << minCodeSize;
		const eoi = clear + 1;
		let codeSize = minCodeSize + 1;
		let next = eoi + 1;
		table.fill(-1);

		const block = new Uint8Array(255);
		let blen = 0;
		let acc = 0;
		let bits = 0;
		const flushByte = (b) => {
			block[blen++] = b;
			if (blen === 255) {
				out.byte(255);
				out.bytes(block);
				blen = 0;
			}
		};
		const write = (code) => {
			acc |= code << bits;
			bits += codeSize;
			while (bits >= 8) {
				flushByte(acc & 0xff);
				acc >>>= 8;
				bits -= 8;
			}
		};
		const bump = () => {
			if (next >= 1 << codeSize && codeSize < 12) codeSize++;
		};

		out.byte(minCodeSize);
		write(clear);
		let prefix = indices[0];
		for (let i = 1; i < indices.length; i++) {
			const k = indices[i];
			const key = prefix * 256 + k;
			const hit = table[key];
			if (hit >= 0) {
				prefix = hit;
				continue;
			}
			write(prefix);
			bump();
			if (next < 4096) {
				table[key] = next++;
			} else {
				write(clear);
				table.fill(-1);
				codeSize = minCodeSize + 1;
				next = eoi + 1;
			}
			prefix = k;
		}
		write(prefix);
		bump();
		write(eoi);
		if (bits > 0) flushByte(acc & 0xff);
		if (blen > 0) {
			out.byte(blen);
			out.bytes(block.subarray(0, blen));
		}
		out.byte(0); // block terminator
	}

	HT.encodeGIF = function (frames, { delay = 10, loop = 0 } = {}) {
		const w = frames[0].width;
		const h = frames[0].height;
		const out = new Bytes();
		out.str('GIF89a');
		out.short(w);
		out.short(h);
		out.byte(0x70); // no global color table, 8-bit color resolution
		out.byte(0);
		out.byte(0);

		// NETSCAPE2.0 looping extension
		out.bytes([0x21, 0xff, 0x0b]);
		out.str('NETSCAPE2.0');
		out.bytes([0x03, 0x01]);
		out.short(loop);
		out.byte(0);

		for (const f of frames) {
			const { palette, indices } = quantize(f.data);
			// graphic control extension
			out.bytes([0x21, 0xf9, 0x04, 0x00]);
			out.short(delay);
			out.bytes([0x00, 0x00]);
			// image descriptor with an 8-bit local color table
			out.byte(0x2c);
			out.short(0);
			out.short(0);
			out.short(w);
			out.short(h);
			out.byte(0x87);
			out.bytes(palette);
			lzw(indices, out);
		}
		out.byte(0x3b);
		return out.result();
	};
})();
