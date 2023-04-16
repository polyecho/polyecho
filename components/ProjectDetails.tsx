import {
	AddCircleOutline,
	Download,
	PauseRounded,
	Person,
	PlayArrowRounded,
	SkipPrevious,
	Square,
} from '@mui/icons-material'
import {
	Avatar,
	AvatarGroup,
	Box,
	Button,
	Chip,
	CircularProgress,
	Divider,
	Fab,
	IconButton,
	Typography,
} from '@mui/material'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Fragment, useEffect, useState } from 'react'

// import web3 from 'web3'
import { NETWORK_CURRENCY } from '../constants/networks'
import { post } from '../lib/http'
import logger from '../lib/logger'
// import logoBinary from '../lib/logoBinary'
import type { ProjectDoc, StemDoc } from '../models'
import { AudioFile } from '../pages/api/flatten'
// import type { INft } from '../models/nft.model'
import OneIcon from '../public/harmony_icon.svg'
import { detailsStyles as styles } from '../styles/Projects.styles'
import formatAddress from '../utils/formatAddress'
import ImageOptimized from './ImageOptimized'
import Notification from './Notification'
import StemUploadDialog from './StemUploadDialog'
import { useWeb3 } from './Web3Provider'

// Because our stem player uses Web APIs for audio, we must ignore it for SSR to avoid errors
const StemPlayer = dynamic(() => import('./StemPlayer'), { ssr: false })

type ProjectDetailsProps = {
	details: ProjectDoc
	uploadStemOpen: boolean
	handleUploadStemOpen: () => void
	handleUploadStemClose: () => void
	onStemUploadSuccess: (project: ProjectDoc) => void
}

const ProjectDetails = (props: ProjectDetailsProps): JSX.Element | null => {
	const { details, handleUploadStemOpen, handleUploadStemClose, uploadStemOpen, onStemUploadSuccess } = props
	// Notifications
	const [successOpen, setSuccessOpen] = useState<boolean>(false)
	const [successMsg, setSuccessMsg] = useState<string>('')
	const [downloading, setDownloading] = useState<boolean>(false)
	const [downloadingMsg, setDownloadingMsg] = useState<string>('')
	const [errorOpen, setErrorOpen] = useState<boolean>(false)
	const [errorMsg, setErrorMsg] = useState<string>('')
	// Minting
	const [minting, setMinting] = useState<boolean>(false)
	const [mintingOpen, setMintingOpen] = useState<boolean>(false)
	const [mintingMsg, setMintingMsg] = useState<string>('')
	// Stems
	const [stems, setStems] = useState<Map<number, any>>(new Map())
	const [stemBlobs, setStemBlobs] = useState<Map<string, Blob>>(new Map())
	// Play/Pause/Mute/Solo
	const [isPlayingAll, setIsPlayingAll] = useState<boolean>(false)
	const [mutedTracks, setMutedTracks] = useState<number[]>([])
	const [soloedTracks, setSoloedTracks] = useState<number[]>([])
	const [handleUnmuteAll, setHandleUnmuteAll] = useState<boolean>(false)
	// Hooks
	const router = useRouter()
	const { NFTStore, contracts, connected, currentUser, handleConnectWallet } = useWeb3()

	useEffect(() => {
		if (soloedTracks.length > 0 && soloedTracks.length === stems.size) {
			setHandleUnmuteAll(unMuteAll => !unMuteAll)
			setSoloedTracks([])
			setMutedTracks([])
		}
		stems.forEach((stem, idx) => {
			if (soloedTracks.includes(idx)) {
				stem.setMute(false)
			} else if (soloedTracks.length > 0) {
				stem.setMute(true)
			} else {
				stem.setMute(mutedTracks.includes(idx))
			}
		})
	}, [soloedTracks, mutedTracks, stems])

	if (!details) return null

	const limitReached = details ? details.stems.length >= details.trackLimit : false

	/*
		Stem Player callbacks
	*/
	const onWavesInit = (idx: number, ws: any) => {
		const tmp = new Map(stems.entries())
		tmp.set(idx, ws)
		setStems(tmp)
	}

	const onNewFile = (filename: string, newFile: Blob) => {
		setStemBlobs(files => new Map(files.set(filename, newFile)))
	}

	/*
		Playback handlers
	*/
	const handlePlayPauseStems = () => {
		// Play or pause each stem audio from wavesurfer
		stems.forEach(ws => {
			if (ws !== null) ws?.playPause()
		})
		// Toggle state
		setIsPlayingAll(!isPlayingAll)
	}

	const handleStop = () => {
		// Stop playing all tracks
		stems.forEach(ws => {
			if (ws !== null) ws?.stop()
		})
		setIsPlayingAll(false)
	}

	const handleSkipPrev = () => {
		// Bring all tracks back to beginning
		stems.forEach(ws => {
			if (ws !== null) ws?.seekTo(0)
		})
	}

	const handlePlay = () => {
		stems.forEach(stem => stem.play())
	}

	const onStop = () => {
		stems.forEach(stem => stem.stop())
	}

	const handleSolo = (idx: number) => {
		if (soloedTracks.includes(idx)) {
			setSoloedTracks(soloedTracks.filter(i => i !== idx))
			setMutedTracks(mutedTracks.filter(i => i !== idx))
		} else {
			setSoloedTracks([...soloedTracks, idx])
			setMutedTracks(mutedTracks.filter(i => i !== idx))
		}
	}

	const handleMute = (idx: number) => {
		if (mutedTracks.includes(idx)) {
			setMutedTracks(mutedTracks.filter(i => i !== idx))
			setSoloedTracks(soloedTracks.filter(i => i !== idx))
		} else {
			setMutedTracks([...mutedTracks, idx])
			setSoloedTracks(soloedTracks.filter(i => i !== idx))
		}
	}

	const handleDownloadAll = async () => {
		try {
			setDownloading(true)
			setDownloadingMsg('Downloading project stems... please wait as we ping IPFS')
			const stemData = details.stems.map((stem: StemDoc) => ({ url: stem.audioUrl, filename: stem.filename })) ?? []
			const zip = new JSZip()
			while (stemData.length != stemBlobs.size) {
				await new Promise(r => setTimeout(r, 500))
			}
			stemBlobs.forEach((data: Blob, filename: string) => {
				zip.file(filename + '.wav', data)
			})
			const content = await zip.generateAsync({ type: 'blob' })
			// Notify success
			if (!downloading) setDownloading(true)
			setDownloadingMsg('Stems downloaded and compressed, please select a location to save them')
			// After the stems zip is downloaded, prompt the user to chose a save file location
			saveAs(content, `ArborStems_${details.name}_${Date.now()}.zip`)
			setDownloading(false)
			setDownloadingMsg('')
			setSuccessOpen(true)
			// TODO: Await until they confirm the selection from the saveAs window
			setSuccessMsg(`Stem(s) downloaded succussfully`)
		} catch (e: any) {
			logger.red(e.message)
			setErrorOpen(true)
			setErrorMsg('Failed to download all stems')
		}
	}

	// TODO: Keep track of minted versions and how many mints a project has undergone
	const handleMintAndBuy = async () => {
		try {
			if (details && currentUser) {
				setMinting(true)
				if (!mintingOpen) setMintingOpen(true)
				setMintingMsg('Combining stems into a single song...')

				// Construct files and call flattening service
				const audioFiles: AudioFile[] = details.stems.map(s => ({
					cid: s.audioUrl.replace('ipfs://', '').replace('/blob', ''),
					filename: s.filename,
				}))
				const flattenRes = await post('/flatten', { audioFiles })
				console.log({ flattenRes })

				/*
				// NOTE: We hit this directly with fetch because Next.js API routes have a 4MB limit
				// See - https://nextjs.org/docs/messages/api-routes-response-size-limit
				if (!process.env.PYTHON_HTTP_HOST) throw new Error('Flattening host not set.')
				const response = await fetch(process.env.PYTHON_HTTP_HOST + '/merge', {
					method: 'POST',
					body: formData,
				})

				// Catch flatten audio error
				if (!response.ok) throw new Error('Failed to flatten the audio files')
				if (response.body === null) throw new Error('Failed to flatten audio files, response body empty.')

				const flattenedAudioBlob = await response.blob()
				if (!flattenedAudioBlob) throw new Error('Failed to flatten the audio files')

				if (!mintingOpen) setMintingOpen(true)
				setMintingMsg('Uploading to NFT.storage...')

				// Construct NFT.storage data and store
				const nftsRes = await NFTStore.store({
					name: details.name, // TODO: plus a version number?
					description:
						'An Arbor Audio NFT representing collaborative music from multiple contributors on the decentralized web.',
					image: new Blob([Buffer.from(logoBinary, 'base64')], { type: 'image/*' }),
					properties: {
						createdOn: new Date().toISOString(),
						createdBy: currentUser.address,
						audio: flattenedAudioBlob,
						collaborators: details.collaborators,
						stems: details.stems.map((s: any) => s.metadataUrl),
					},
				})

				// Check for data
				if (!nftsRes) throw new Error('Failed to store on NFT.storage')

				// Call smart contract and mint an nft out of the original CID
				if (!mintingOpen) setMintingOpen(true)
				setMintingMsg('Minting the NFT. This could take a moment...')
				const amount = web3.utils.toWei('0.01', 'ether')
				const mintRes: any = await contracts.nft.mintAndBuy(currentUser.address, nftsRes.url, details.collaborators, {
					value: amount,
					from: currentUser.address,
					gasLimit: 2000000,
				})
				const receipt = await mintRes.wait()

				// Add new NFT to database and user details
				if (!mintingOpen) setMintingOpen(true)
				setMintingMsg('Updating user details...')
				const newNftPayload: INft = {
					createdBy: currentUser.address,
					owner: currentUser.address,
					isListed: false,
					listPrice: 0,
					token: {
						// TODO: Parse the correct arguments from the event receipt
						id: parseInt(
							receipt.events.TokenCreated?.returnValues.newTokenId ||
								receipt.events.TokenCreated?.returnValues.tokenId ||
								receipt.events.TokenCreated?.returnValues._tokenId ||
								0, // default
						),
						tokenURI:
							receipt.events.TokenCreated?.returnValues.newTokenURI ||
							receipt.events.TokenCreated?.returnValues.tokenURI ||
							receipt.events.TokenCreated?.returnValues._tokenURI ||
							'', // default
						data: mintRes,
					},
					name: details.name,
					metadataUrl: nftsRes.url,
					audioHref: nftsRes.data.properties.audio,
					projectId: details._id.toString(),
					collaborators: details.collaborators,
					stems: details.stems, // Direct 1:1 deep clone
				}
				const nftCreated = await post('/nfts', newNftPayload)
				if (!nftCreated.success) throw new Error(nftCreated.error)

				// Notify success
				if (!successOpen) setSuccessOpen(true)
				setSuccessMsg('Success! You now own this music NFT, redirecting...')
				setMinting(false)
				setMintingMsg('')

				// Route to user's profile page
				router.push(`/users/${currentUser.address}`)
				*/
			}
		} catch (e: any) {
			logger.red(e)
			// Notify error
			setMintingOpen(false)
			setMintingMsg('')
			setErrorOpen(true)
			setErrorMsg('Uh oh, failed to mint the NFT')
			setMinting(false)
		}
	}

	const onNotificationClose = () => {
		setSuccessOpen(false)
		setSuccessMsg('')
		setErrorOpen(false)
		setErrorMsg('')
		setDownloading(false)
		setDownloadingMsg('')
		setMintingOpen(false)
		setMintingMsg('')
	}

	return (
		<>
			<Box sx={styles.headingWrap}>
				<Box sx={styles.playAllWrap}>
					<Fab
						size="large"
						onClick={handlePlayPauseStems}
						/* @ts-ignore */
						sx={styles.playAllBtn}
						disabled={details.stems.length === 0}
						title={isPlayingAll ? 'Pause playback' : 'Play all stems simultaneously'}
					>
						{isPlayingAll ? <PauseRounded sx={styles.playAllIcon} /> : <PlayArrowRounded sx={styles.playAllIcon} />}
					</Fab>
				</Box>
				<Box sx={{ flexGrow: 1 }}>
					<Box>
						<Typography sx={styles.createdBy}>
							Created by <Link href={`/users/${details.createdBy}`}>{formatAddress(details.createdBy)}</Link>
						</Typography>
						<Typography variant="h4" component="h2" sx={styles.title}>
							{details.name}
						</Typography>
					</Box>
					<Box sx={styles.metadataWrap}>
						<Typography sx={styles.metadata}>
							<Typography component="span" sx={styles.metadataKey}>
								BPM
							</Typography>
							{details.bpm}
						</Typography>
						<Typography sx={styles.metadata}>
							<Typography component="span" sx={styles.metadataKey}>
								Track Limit
							</Typography>
							{details.trackLimit} Tracks
							{limitReached && <Chip label="Limit Reached" size="small" sx={styles.limitReachedChip} />}
						</Typography>
						<Typography sx={styles.metadata}>
							<Typography component="span" sx={styles.metadataKey}>
								Open To
							</Typography>
							Anyone
						</Typography>
					</Box>
					<Typography sx={styles.desc}>{details.description}</Typography>
					{details.tags.length > 0 &&
						details.tags.map((tag: string) => (
							<Chip key={tag} label={tag} variant="outlined" color="primary" sx={styles.tag} />
						))}
					<Divider sx={styles.divider} />
					{details.stems.length > 0 && (
						<Box sx={styles.mintAndBuy}>
							<Button
								size="large"
								onClick={connected ? handleMintAndBuy : handleConnectWallet}
								variant="contained"
								color="secondary"
								sx={styles.mintAndBuyBtn}
								disabled={minting || details.stems.length < 2}
							>
								{minting ? <CircularProgress size={30} sx={{ my: 1.5 }} /> : 'Mint & Buy'}
							</Button>
							<Box sx={styles.price}>
								<ImageOptimized src={OneIcon} width={30} height={30} alt={NETWORK_CURRENCY} />
								<Typography variant="h4" component="div" sx={{ ml: 1 }}>
									0.01{' '}
									<Typography sx={styles.eth} component="span">
										{NETWORK_CURRENCY}
									</Typography>
								</Typography>
							</Box>
						</Box>
					)}
				</Box>
			</Box>
			{/* @ts-ignore */}
			<Box sx={styles.stemsHeader}>
				<Typography variant="h4" component="h3" sx={styles.stemsTitle}>
					Song Stems
				</Typography>
				<Box sx={styles.playSection}>
					<IconButton
						sx={styles.playStopBtn}
						onClick={handlePlayPauseStems}
						disableRipple
						disableFocusRipple
						title={isPlayingAll ? 'Pause playback' : 'Play all stems simultaneously'}
					>
						{isPlayingAll ? (
							<PauseRounded sx={{ width: '2rem', height: '2rem' }} />
						) : (
							<PlayArrowRounded sx={{ width: '2rem', height: '2rem' }} />
						)}
					</IconButton>
					<IconButton
						sx={styles.playStopBtn}
						onClick={handleStop}
						disableRipple
						disableFocusRipple
						title="Stop playback"
					>
						<Square />
					</IconButton>
					<IconButton
						sx={styles.playStopBtn}
						onClick={handleSkipPrev}
						disableRipple
						disableFocusRipple
						title="Skip to beginning"
					>
						<SkipPrevious />
					</IconButton>
				</Box>
				<Box sx={styles.stemsMeta}>
					<Typography>
						{details.stems.length} Stem{details.stems.length === 1 ? '' : 's'} from {details.collaborators.length}{' '}
						Collaborator
						{details.collaborators.length === 1 ? '' : 's'}
					</Typography>
					<AvatarGroup sx={styles.avatarGroup} total={details.collaborators.length}>
						{details.collaborators.map((c, idx) => (
							<Link key={idx} href={`/users/${c}`} passHref>
								<Avatar>
									<Person />
								</Avatar>
							</Link>
						))}
					</AvatarGroup>
				</Box>
				<Box>
					{/* @ts-ignore */}
					<Button
						sx={styles.exportStemsBtn}
						onClick={handleDownloadAll}
						endIcon={<Download />}
						disabled={details.stems.length !== stemBlobs.size || details.stems.length === 0}
					>
						Export Stems
					</Button>
				</Box>
			</Box>
			{details.stems.length > 0 ? (
				details.stems.map((stem, idx) => (
					<Fragment key={idx}>
						<StemPlayer
							idx={idx + 1}
							details={stem}
							onWavesInit={onWavesInit}
							onFinish={() => setIsPlayingAll(false)}
							onNewFile={onNewFile}
							onPlay={handlePlay}
							onSolo={handleSolo}
							onMute={handleMute}
							onStop={onStop}
							handleUnmuteAll={handleUnmuteAll}
						/>
					</Fragment>
				))
			) : (
				<Typography sx={styles.noStemsMsg}>No stems to show, upload one!</Typography>
			)}
			{!limitReached && (
				<>
					<Button
						variant="outlined"
						size="large"
						onClick={handleUploadStemOpen}
						/* @ts-ignore */
						sx={styles.addStemBtn}
						startIcon={<AddCircleOutline sx={{ fontSize: '32px' }} />}
					>
						Add Stem
					</Button>
					<StemUploadDialog
						open={uploadStemOpen}
						onClose={handleUploadStemClose}
						onSuccess={onStemUploadSuccess}
						/* @ts-ignore */
						projectDetails={details}
					/>
				</>
			)}
			{downloading && (
				<Notification
					open={downloading}
					msg={downloadingMsg}
					type="info"
					onClose={onNotificationClose}
					duration={10000}
				/>
			)}
			{mintingOpen && (
				<Notification open={mintingOpen} msg={mintingMsg} type="info" onClose={onNotificationClose} duration={10000} />
			)}
			{successOpen && <Notification open={successOpen} msg={successMsg} type="success" onClose={onNotificationClose} />}
			{errorOpen && <Notification open={errorOpen} msg={errorMsg} type="error" onClose={onNotificationClose} />}
		</>
	)
}

export default ProjectDetails
