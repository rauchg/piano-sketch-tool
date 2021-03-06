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
	sequencerHeight,
	pianoWidth,
	midiRange,
} from "./helpers"
import { MidiEmitter } from "./MidiEmitter"
import { setSongUrl } from "./routeHelpers"

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

type SequencerRecordingState = {
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

class Sequencer {
	public rootElm: HTMLDivElement
	public scrollerElm: HTMLDivElement
	public noteGuides: Record<number, HTMLDivElement> = {}
	public completedNotes: Array<CompletedNote> = []
	public incompleteNotes: Array<IncompletedNote> = []

	public renderMidiNote(event: MidiEvent) {
		const { keyOn, midiNote, timeMs } = event
		if (keyOn) {
			const i = this.incompleteNotes.findIndex(
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
			div.style.bottom = `${timeMs * pixelsPerMillisecond}px`
			div.style.top = "0px"

			div.style.width = isBlackNote(midiNote)
				? `${blackNoteWidth}px`
				: `${whiteNoteWidth}px`
			div.style.background = isBlackNote(midiNote)
				? blackNoteColor
				: whiteNoteColor

			this.rootElm.appendChild(div)

			this.incompleteNotes.push({
				midiNote,
				startMs: timeMs,
				elm: div,
			})
		} else {
			const i = this.incompleteNotes.findIndex(
				note => note.midiNote === midiNote
			)
			if (i !== -1) {
				const [note] = this.incompleteNotes.splice(i, 1)
				note.elm.style.top = null as any
				note.elm.style.height = `${(timeMs - note.startMs) *
					pixelsPerMillisecond}px`
				this.completedNotes.push({ ...note, endMs: timeMs })
			} else {
				console.log("Missing start note!")
			}
		}
	}

	constructor(div: HTMLDivElement) {
		// Reset
		while (div.firstChild) {
			div.removeChild(div.firstChild)
		}

		div.style.position = "absolute"
		div.style.top = "0px"
		div.style.left = "0px"
		div.style.right = "0px"
		div.style.height = "0px"

		for (let i = midiRange.start; i < midiRange.end; i++) {
			// Create the light gray guide lines
			if (i % 12 === 0 || i % 12 === 5) {
				const makeGuide = () => {
					const elm = document.createElement("div")
					elm.style.position = "absolute"
					elm.style.top = "0px"
					elm.style.bottom = "0px"
					elm.style.width = "2px"
					elm.style.background = "#d0d0d0"
					elm.style.left = `${getXPosition(i) - 2}px`
					return elm
				}
				div.appendChild(makeGuide())
				div.parentElement!.appendChild(makeGuide())
			}

			// Create note highlight guides
			const makeNoteGuide = () => {
				const elm = document.createElement("div")
				elm.style.position = "absolute"
				elm.style.top = "0px"
				elm.style.bottom = "0px"
				elm.style.width = isBlackNote(i)
					? `${blackNoteWidth}px`
					: `${whiteNoteWidth}px`
				elm.style.background = isBlackNote(i) ? blackNoteColor : whiteNoteColor
				elm.style.left = `${getXPosition(i)}px`
				elm.style.opacity = 0 as any
				this.noteGuides[i] = elm
				return elm
			}

			div.appendChild(makeNoteGuide())
		}
		this.rootElm = div
		this.scrollerElm = div.parentElement! as HTMLDivElement
	}
}

class NewRecording {
	public sequencer: Sequencer

	public startRecording(midiInstrument: MidiEmitter) {
		return new Recording(this, midiInstrument)
	}

	constructor(div: HTMLDivElement) {
		this.sequencer = new Sequencer(div)
	}
}

class Recording {
	public sequencer: Sequencer
	public events: Array<MidiEvent> = []

	public recordMidiEvent = (keyOn: boolean, midiNote: number) => {
		const event: MidiEvent = {
			keyOn,
			midiNote,
			timeMs: Date.now() - this.startMs,
		}
		this.events.push(event)
		this.sequencer.renderMidiNote(event)
	}

	public stopRecording = () => {
		this.midiInstrument.removeListener(this.recordMidiEvent)
		this.isRecording = false

		const remainingNotes = this.sequencer.incompleteNotes.map(
			({ midiNote }) => midiNote
		)
		for (const midiNote of remainingNotes) {
			this.recordMidiEvent(false, midiNote)
		}
		return cleanMidiEvents(this.events)
	}

	private midiInstrument: MidiEmitter
	constructor(state: NewRecording, midiInstrument: MidiEmitter) {
		this.sequencer = state.sequencer
		this.midiInstrument = midiInstrument
		this.midiInstrument.addListener(this.recordMidiEvent)
		requestAnimationFrame(this.tick)
	}

	private isRecording = true
	private startMs = Date.now()
	private tick = () => {
		if (!this.isRecording) {
			return
		}
		const timeMs = Date.now() - this.startMs
		this.sequencer.rootElm.style.height = `${timeMs * pixelsPerMillisecond}px`
		requestAnimationFrame(this.tick)
	}
}

class Player {
	public sequencer: Sequencer
	public events: Array<MidiEvent>
	public midiPlayback: MidiEmitter

	public resetScroller() {
		this.sequencer.scrollerElm.scrollTop = this.sequencer.scrollerElm.scrollHeight
	}

	constructor(
		div: HTMLDivElement,
		events: Array<MidiEvent>,
		midiPlayback: MidiEmitter
	) {
		this.sequencer = new Sequencer(div)
		this.events = events
		this.midiPlayback = midiPlayback

		for (const event of events) {
			this.sequencer.renderMidiNote(event)
		}

		const maxMs = _.max(events.map(e => e.timeMs)) || 0
		const height = maxMs * pixelsPerMillisecond
		this.sequencer.rootElm.style.height = `${height}px`
		this.sequencer.rootElm.style.position = "relative"
		this.sequencer.rootElm.style.paddingTop = `${sequencerHeight}px`
		this.sequencer.scrollerElm.scrollTop = height

		setSongUrl(events)
	}

	private playing = false
	public speed = 1
	private onFinishedPlaying = _.noop
	private lastTickMs: number
	private lastScrollTop: number

	public stopPlaying() {
		this.playing = false
		this.sequencer.scrollerElm.style.overflow = "auto"
		this.midiPlayback.clear()
	}

	private scrollTopToPxToMs = (scrollTop: number) => {
		return (
			(this.sequencer.scrollerElm.scrollHeight - sequencerHeight - scrollTop) /
			pixelsPerMillisecond
		)
	}

	private msToScrollTopPx = (timeMs: number) => {
		return (
			this.sequencer.scrollerElm.scrollHeight -
			sequencerHeight -
			timeMs * pixelsPerMillisecond
		)
	}

	private tick = () => {
		if (!this.playing) {
			return
		}
		const dt = Date.now() - this.lastTickMs
		this.lastTickMs = Date.now()

		const currentTime = this.scrollTopToPxToMs(this.lastScrollTop)

		// Recompute next time from truncated scrollTop because fractional scroll
		// positions aren't allowed.
		const nextTime = currentTime + dt * this.speed

		for (const event of this.events) {
			if (event.timeMs >= currentTime && event.timeMs < nextTime) {
				this.midiPlayback.emit(event.keyOn, event.midiNote)
			}
		}

		this.lastScrollTop = this.msToScrollTopPx(nextTime)
		this.sequencer.scrollerElm.scrollTop = this.lastScrollTop

		if (this.lastScrollTop <= 0) {
			this.stopPlaying()
			this.onFinishedPlaying()
			return
		}

		requestAnimationFrame(this.tick)
	}

	public startPlaying(onFinishedPlaying?: () => void) {
		this.onFinishedPlaying = _.once(onFinishedPlaying || _.noop)
		this.lastTickMs = Date.now()
		this.lastScrollTop = this.sequencer.scrollerElm.scrollTop
		this.sequencer.scrollerElm.style.overflow = "hidden"
		this.playing = true
		requestAnimationFrame(this.tick)
	}

	public highlightMidiNote = (keyOn: boolean, midiNote: number) => {
		this.sequencer.noteGuides[midiNote].style.opacity = keyOn ? "0.3" : "0"
	}
}

interface SequencerRendererProps {
	onMount: (div: HTMLDivElement) => void
}

export class SequencerRenderer extends React.PureComponent<
	SequencerRendererProps
> {
	private handleRef = (div: HTMLDivElement | null) => {
		if (div) {
			this.props.onMount(div)
		}
	}

	render() {
		return (
			<React.Fragment>
				<div
					style={{
						overflow: "auto",
						height: sequencerHeight,
						border: "1px solid black",
						boxSizing: "border-box",
						width: pianoWidth,
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
	midiInstrument: MidiEmitter
	render: (props: {
		recording: boolean
		start: () => void
		stop: () => Array<MidiEvent>
		sequencer: JSX.Element
	}) => React.ReactNode
}

interface SequenceRecorderState {
	recording: boolean
}

export class SequenceRecorder extends React.PureComponent<
	SequenceRecorderProps,
	SequenceRecorderState
> {
	state: SequenceRecorderState = { recording: false }

	private recorder: NewRecording | Recording | undefined

	private handleMount = (div: HTMLDivElement) => {
		this.recorder = new NewRecording(div)
	}

	private handleStart = () => {
		this.setState({ recording: true })
		if (this.recorder && this.recorder instanceof NewRecording) {
			this.recorder = this.recorder.startRecording(this.props.midiInstrument)
		}
	}

	private handleStop = () => {
		this.setState({ recording: false })
		if (this.recorder && this.recorder instanceof Recording) {
			const events = this.recorder.stopRecording()
			return events
		}
		return []
	}

	render() {
		return this.props.render({
			recording: this.state.recording,
			start: this.handleStart,
			stop: this.handleStop,
			sequencer: (
				<SequencerRenderer key="recorder" onMount={this.handleMount} />
			),
		})
	}
}

interface SequencePlayerProps {
	midiInstrument: MidiEmitter
	midiPlayback: MidiEmitter
	events: Array<MidiEvent>
	render: (props: {
		playing: boolean
		play: () => void
		pause: () => void
		restart: () => void
		speed: number
		setSpeed: (speed: number) => void
		sequencer: JSX.Element
	}) => React.ReactNode
}

interface SequencePlayerState {
	playing: boolean
	speed: number
}

export class SequencePlayer extends React.PureComponent<
	SequencePlayerProps,
	SequencePlayerState
> {
	state: SequencePlayerState = {
		playing: false,
		speed: 1,
	}
	private player: Player | undefined

	componentWillUnmount() {
		if (this.player) {
			this.props.midiInstrument.removeListener(this.player.highlightMidiNote)
		}
	}

	private handleMount = (div: HTMLDivElement) => {
		this.player = new Player(div, this.props.events, this.props.midiPlayback)
		this.props.midiInstrument.addListener(this.player.highlightMidiNote)
	}

	private handlePlay = () => {
		if (this.player) {
			this.setState({
				...this.state,
				playing: true,
			})
			this.player.speed = this.state.speed
			this.player.startPlaying(this.handleStop)
		}
	}

	private handleStop = () => {
		if (this.player) {
			this.setState({
				...this.state,
				playing: false,
			})
			this.player.stopPlaying()
		}
	}

	private handleRestart = () => {
		if (this.player) {
			this.player.resetScroller()
		}
	}

	private handleSpeedChange = (s: number) => {
		const speed = Math.min(3, Math.max(0.01, s))
		this.setState({
			...this.state,
			speed,
		})
		if (this.player) {
			this.player.speed = this.state.speed
		}
	}

	render() {
		return this.props.render({
			playing: this.state.playing,
			play: this.handlePlay,
			pause: this.handleStop,
			restart: this.handleRestart,
			speed: this.state.speed,
			setSpeed: this.handleSpeedChange,
			sequencer: <SequencerRenderer key="player" onMount={this.handleMount} />,
		})
	}
}

const maxEvents = 1150

function cleanMidiEvents(events: Array<MidiEvent>) {
	const cleaned: Array<MidiEvent> = []

	let extras: Array<MidiEvent> = []
	if (events.length > maxEvents) {
		extras = events.slice(maxEvents)
		events = events.slice(0, maxEvents)
		alert(
			`You song was more than ${maxEvents /
				2} notes which will not fit into a URL so it has been truncated.`
		)
	}

	let startMs: number | undefined
	let onNotes: Set<number> = new Set()
	for (const { keyOn, midiNote, timeMs } of events) {
		if (startMs === undefined) {
			startMs = timeMs - 1000
		}
		if (keyOn) {
			if (onNotes.has(midiNote)) {
				// Handle key-repeat issues from computer keyboard.
				continue
			}
			onNotes.add(midiNote)
			// Normalize time.
			cleaned.push({ keyOn, midiNote, timeMs: timeMs - startMs })
		} else {
			if (!onNotes.has(midiNote)) {
				// Maybe recording started with a note down. Ignore it.
				continue
			}
			onNotes.delete(midiNote)
			cleaned.push({ keyOn, midiNote, timeMs: timeMs - startMs })
		}
	}
	// Close off any notes that are held down.
	for (const { keyOn, midiNote, timeMs } of extras) {
		if (keyOn === false && onNotes.has(midiNote)) {
			onNotes.delete(midiNote)
			cleaned.push({ keyOn, midiNote, timeMs: timeMs - startMs! })
		}
	}

	return cleaned
}
