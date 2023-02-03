import { PlayArrow, SkipPrevious, Square } from '@mui/icons-material'
import { Box, Button, ButtonGroup, Grid, Typography } from '@mui/material'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

import { IProjectDoc } from '../models/project.model'
import type { IStemDoc } from '../models/stem.model'
import formatAddress from '../utils/formatAddress'
import formatStemName from '../utils/formatStemName'
import { stemTypesToColor } from './ArborThemeProvider'
import styles from './StemPlayer.styles'
import StemQueue from './StemQueue/StemQueue'

// We have to pass back up callbacks because we use global controls outside of this player's track
type StemPlayerProps = {
	idx: number
	details: IStemDoc | any
	projectDetails?: IProjectDoc
	votes?: number
	userIsCollaborator?: boolean
	userIsRegisteredVoter?: boolean
	onWavesInit: (idx: number, ws: any) => any
	onFinish?: (idx: number, ws: any) => any
	isStemDetails?: boolean
	isQueued?: boolean
	onPlay?: (idx: number) => any
	onSolo?: (idx: number) => any
	onMute?: (idx: number) => any
	onSkipPrev?: () => any
	onStop?: (idx: number) => any
	onNewFile?: (newFileName: string, newFile: Blob) => void
	handleUnmuteAll?: boolean
	onRegisterSuccess?: (project: IProjectDoc) => void
	onVoteSuccess?: (project: IProjectDoc, stemName: string) => void
	onApprovedSuccess?: (project: IProjectDoc, stemName: string) => void
	onFailure?: (msg: string) => void
}

const StemPlayer = (props: StemPlayerProps): JSX.Element => {
	const {
		idx,
		details,
		onWavesInit,
		onFinish,
		isStemDetails,
		isQueued,
		onPlay,
		onSolo,
		onMute,
		onSkipPrev,
		onStop,
		onNewFile,
		handleUnmuteAll,
		userIsCollaborator,
		userIsRegisteredVoter,
		projectDetails,
		onRegisterSuccess,
		onVoteSuccess,
		onApprovedSuccess,
		onFailure,
		votes,
	} = props

	const [isMuted, setIsMuted] = useState<boolean>(false)
	const [isSoloed, setIsSoloed] = useState<boolean>(false)
	const [blob, setBlob] = useState<Blob>()
	const [loadingBlob, setLoadingBlob] = useState<boolean>(false)

	const stem = { stem: details, votes: votes || 0 }
	useEffect(() => {
		if (!blob) {
			if (!loadingBlob) {
				setLoadingBlob(true)
				fetch(details.audioHref).then(resp => {
					resp.blob().then(b => {
						setBlob(b)
						if (onNewFile) onNewFile(details.name, b)
					})
				})
				setLoadingBlob(false)
			}
		} else {
			const ws = WaveSurfer.create({
				container: `#waveform-${details._id}-${idx}`,
				waveColor: '#bbb',
				progressColor: '#444',
				cursorColor: '#656565',
				barWidth: 3,
				barRadius: 3,
				cursorWidth: 1,
				height: 80,
				barGap: 2,
			})

			// Load audio from an XHR request
			ws.loadBlob(blob)

			// Skip back to zero when finished playing
			ws.on('finish', () => {
				ws.seekTo(0)
				if (onFinish) onFinish(idx, ws)
			})

			// Callback to the parent
			onWavesInit(idx, ws)
			return () => ws.destroy()
		}
	}, [blob, loadingBlob]) /* eslint-disable-line react-hooks/exhaustive-deps */

	useEffect(() => {
		setIsSoloed(false)
	}, [handleUnmuteAll])

	const toggleMute = () => {
		setIsMuted(!isMuted)
		setIsSoloed(false)
		if (onMute) onMute(idx)
	}

	const toggleSolo = () => {
		setIsSoloed(!isSoloed)
		setIsMuted(false)
		if (onSolo) onSolo(idx)
	}

	return (
		<Box sx={isQueued ? styles.queuedStem : styles.stem}>
			<Box sx={{ ...styles.header, backgroundColor: stemTypesToColor[details.type] || '#dadada' }}>
				<Grid container spacing={2} sx={{ alignItems: 'center' }}>
					<Grid item xs={10}>
						<Typography sx={styles.title} variant="h4">
							{formatStemName(details.name || details.filename)}
						</Typography>
						<Typography sx={styles.addedBy}>
							Added X hours ago by{' '}
							<Typography sx={styles.addressLink} component="span">
								<Link href={`/users/${details.createdBy}`}>{formatAddress(details.createdBy)}</Link>
							</Typography>
						</Typography>
					</Grid>
					<Grid item xs={2} sx={{ textAlign: 'right' }}>
						<Button variant="outlined" size="small" sx={styles.forkBtn} disabled>
							Fork
						</Button>
					</Grid>
				</Grid>
			</Box>
			<Box sx={styles.playback}>
				<Grid container spacing={1}>
					<Grid item xs={1} sx={styles.btnsWrap}>
						<ButtonGroup sx={styles.btnGroup} orientation="vertical">
							{isStemDetails ? (
								<>
									{isQueued && (
										<Button size="small" onClick={() => (onPlay ? onPlay(idx) : null)} title="Play stem">
											<PlayArrow fontSize="small" />
										</Button>
									)}
									{isStemDetails && (
										<Button size="small" onClick={onSkipPrev} title="Skip to beginning">
											<SkipPrevious />
										</Button>
									)}
									<Button size="small" onClick={() => (onStop ? onStop(idx) : null)} title="Stop stem">
										<Square fontSize="small" />
									</Button>
								</>
							) : (
								<>
									<Button
										variant={isMuted ? 'contained' : 'outlined'}
										size="small"
										onClick={toggleMute}
										title="Mute stem"
									>
										M
									</Button>
									<Button
										variant={isSoloed ? 'contained' : 'outlined'}
										size="small"
										onClick={toggleSolo}
										title="Solo stem"
									>
										S
									</Button>
								</>
							)}
						</ButtonGroup>
						{isQueued &&
							userIsCollaborator !== undefined &&
							userIsRegisteredVoter !== undefined &&
							projectDetails &&
							onRegisterSuccess &&
							onVoteSuccess &&
							onApprovedSuccess &&
							onFailure && (
								<StemQueue
									userIsCollaborator={userIsCollaborator}
									idx={idx}
									userIsRegisteredVoter={userIsRegisteredVoter}
									onVoteSuccess={onVoteSuccess}
									onApprovedSuccess={onApprovedSuccess}
									onFailure={onFailure}
									details={projectDetails}
									stem={stem}
								/>
							)}
					</Grid>
					<Grid item xs={11}>
						<div id={`waveform-${details._id}-${idx}`} />
					</Grid>
				</Grid>
				{isQueued && (
					<Typography sx={{ mt: 1 }}>
						<strong>Votes:</strong> {votes}
					</Typography>
				)}
			</Box>
		</Box>
	)
}

StemPlayer.defaultProps = {
	isStemDetails: false,
	isQueued: false,
}

export default StemPlayer
