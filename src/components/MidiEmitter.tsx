export const keyMap = {
	a: 0,
	w: 1,
	s: 2,
	e: 3,
	d: 4,
	f: 5,
	t: 6,
	g: 7,
	y: 8,
	h: 9,
	u: 10,
	j: 11,
	k: 12,
	o: 13,
	l: 14,
	p: 15,
	";": 16,
	"'": 17,
}
type MidiNodeListener = (on: boolean, midiNote: number) => void
export class MidiEmitter {
	listeners: Set<MidiNodeListener> = new Set()
	addListener(fn: MidiNodeListener) {
		this.listeners.add(fn)
	}
	removeListener(fn: MidiNodeListener) {
		this.listeners.delete(fn)
	}
	keys: Set<number> = new Set()
	emit(keyOn: boolean, midiNote: number) {
		for (const listener of this.listeners.values()) {
			listener(keyOn, midiNote)
		}
		if (keyOn) {
			this.keys.add(midiNote)
		} else {
			this.keys.delete(midiNote)
		}
	}
	clear() {
		const keys = Array.from(this.keys.values())
		for (const key of keys) {
			this.emit(false, key)
		}
	}
}
