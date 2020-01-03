const keyMap = {
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

export class ComputerKeyboard {
	listeners: Set<MidiNodeListener> = new Set()
	addListener(fn: MidiNodeListener) {
		this.listeners.add(fn)
	}
	removeListener(fn: MidiNodeListener) {
		this.listeners.delete(fn)
	}

	start() {
		window.addEventListener("keydown", this.handleKeyDown)
		window.addEventListener("keyup", this.handleKeyUp)
	}

	stop() {
		window.removeEventListener("keydown", this.handleKeyDown)
		window.removeEventListener("keyup", this.handleKeyUp)
	}

	private handleKeyDown = (event: KeyboardEvent) => {
		if (event.key in keyMap) {
			const midiNote = keyMap[event.key]
			for (const listener of this.listeners.values()) {
				listener(true, midiNote)
			}
		}
	}

	private handleKeyUp = (event: KeyboardEvent) => {
		if (event.key in keyMap) {
			const midiNote = keyMap[event.key]
			for (const listener of this.listeners.values()) {
				listener(false, midiNote)
			}
		}
	}
}