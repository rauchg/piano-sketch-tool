import * as _ from "lodash"
import * as React from "react"
import {
	getXPosition,
	isBlackNote,
	blackNoteWidth,
	whiteNoteWidth,
	blackNoteColor,
	whiteNoteColor,
	pixelsPerMillisecond,
	windowHeight,
	getPianoWidth,
	pianoSize,
} from "./helpers"
import { ComputerMidiSource } from "./MidiSource"

type CompletedNote = {
	midiNote: number
	startMs: number
	endMs: number
	elm: HTMLDivElement
}

type IncompletedNote = {
	midiNote: number
	startMs: number
	elm: HTMLDivElement
}

type SequencerState = {
	root: HTMLDivElement
	completedNotes: Array<CompletedNote>
	incompleteNotes: Array<IncompletedNote>
	events: Array<MidiEvent>
}

export type MidiEvent = {
	keyOn: boolean
	midiNote: number
	timeMs: number
}

export class SequencerRenderer {
	state: SequencerState

	constructor(div: HTMLDivElement) {
		div.style.position = "absolute"
		div.style.bottom = "0px"
		div.style.left = "0px"
		div.style.right = "0px"
		div.style.height = "0px"
		this.state = {
			root: div,
			completedNotes: [],
			incompleteNotes: [],
			events: [],
		}
	}

	stopped = false

	stop() {
		this.stopped = true
	}

	startMs: number | undefined
	start(startMs: number) {
		this.startMs = startMs
		this.stopped = false
		const tick = () => {
			if (this.stopped) {
				return
			}
			const timeMs = Date.now() - startMs
			this.state.root.style.height = `${timeMs * pixelsPerMillisecond}px`
			requestAnimationFrame(tick)
		}
		requestAnimationFrame(tick)
	}

	load(events: Array<MidiEvent>) {
		for (const event of events) {
			this.handleEvent(event)
		}
		const timeMs = _.max(this.state.events.map(e => e.timeMs)) || 0
		this.state.root.style.height = `${timeMs * pixelsPerMillisecond}px`
		this.state.root.style.position = "relative"

		for (const note of this.state.completedNotes) {
			delete note.elm.style.top
			note.elm.style.top = null as any
			note.elm.style.bottom = `${note.startMs * pixelsPerMillisecond}px`
		}
	}

	handleEvent(event: MidiEvent) {
		const { keyOn, midiNote, timeMs } = event
		this.state.events.push(event)

		if (keyOn) {
			const i = this.state.incompleteNotes.findIndex(
				note => note.midiNote === midiNote
			)
			if (i !== -1) {
				// Handle key-repeat
				return
			}

			const div = document.createElement("div")
			div.style.position = "absolute"
			const xPos = getXPosition(midiNote)
			div.style.left = `${xPos}px`
			div.style.top = `${timeMs * pixelsPerMillisecond}px`
			div.style.bottom = "0px"

			div.style.width = isBlackNote(midiNote)
				? `${blackNoteWidth}px`
				: `${whiteNoteWidth}px`
			div.style.background = isBlackNote(midiNote)
				? blackNoteColor
				: whiteNoteColor

			this.state.root.appendChild(div)

			this.state.incompleteNotes.push({
				midiNote,
				startMs: timeMs,
				elm: div,
			})
		} else {
			const i = this.state.incompleteNotes.findIndex(
				note => note.midiNote === midiNote
			)
			if (i !== -1) {
				const [note] = this.state.incompleteNotes.splice(i, 1)
				delete note.elm.style.bottom
				note.elm.style.height = `${(timeMs - note.startMs) *
					pixelsPerMillisecond}px`
				this.state.completedNotes.push({ ...note, endMs: timeMs })
			} else {
				console.log("missing!")
			}
		}
	}
}

interface SequencerProps {
	onMount: (renderer: SequencerRenderer) => void
}

export class Sequencer extends React.PureComponent<SequencerProps> {
	private renderer: SequencerRenderer | undefined

	private handleRef = (div: HTMLDivElement | null) => {
		if (div) {
			this.renderer = new SequencerRenderer(div)
			this.props.onMount(this.renderer)
		}
	}

	render() {
		return (
			<React.Fragment>
				<div
					style={{
						overflow: "auto",
						height: windowHeight,
						border: "1px solid black",
						boxSizing: "border-box",
						width: getPianoWidth(pianoSize - 1),
						position: "relative",
					}}
				>
					<div ref={this.handleRef}></div>
				</div>
			</React.Fragment>
		)
	}
}

interface SequenceRecorderProps {
	source: ComputerMidiSource
	handleStop: (events: Array<MidiEvent>) => void
}

export class SequenceRecorder extends React.PureComponent<
	SequenceRecorderProps
> {
	private renderer: SequencerRenderer | undefined

	private handleMount = (renderer: SequencerRenderer) => {
		this.renderer = renderer
		this.handleStart()
	}

	private handleStart = () => {
		if (this.renderer) {
			this.props.source.addListener(this.handleMidiNote)
			this.renderer.start(Date.now())
		}
	}

	private handleStop = () => {
		this.props.source.removeListener(this.handleMidiNote)
		if (this.renderer) {
			this.renderer.stop()
			this.props.handleStop(this.renderer.state.events)
		}
	}

	private handleMidiNote = (keyOn: boolean, midiNote: number) => {
		if (this.renderer && this.renderer.startMs) {
			this.renderer.handleEvent({
				keyOn,
				midiNote,
				timeMs: Date.now() - this.renderer.startMs,
			})
		}
	}

	render() {
		return (
			<React.Fragment>
				<button onClick={this.handleStop}>stop</button>
				<Sequencer onMount={this.handleMount} />
			</React.Fragment>
		)
	}
}

interface SequencePlayerProps {
	events: Array<MidiEvent>
}

export class SequencePlayer extends React.PureComponent<SequencePlayerProps> {
	private renderer: SequencerRenderer | undefined

	private handleMount = (renderer: SequencerRenderer) => {
		this.renderer = renderer
		this.renderer.load(this.props.events)
	}

	render() {
		return (
			<React.Fragment>
				<button>play?</button>
				<Sequencer onMount={this.handleMount} />
			</React.Fragment>
		)
	}
}
