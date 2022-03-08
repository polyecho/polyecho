import { Box, Container, Divider, Typography } from '@mui/material'
import type { GetServerSideProps, NextPage } from 'next'
// Because our sample player uses Web APIs for audio, we must ignore it for SSR to avoid errors
import dynamic from 'next/dynamic'
import Head from 'next/head'
import Link from 'next/link'
import PropTypes from 'prop-types'
import AppFooter from '../../components/AppFooter'
import AppHeader from '../../components/AppHeader'
import { ISampleDoc } from '../../models/sample.model'
import { get } from '../../utils/http'

const SamplePlayer = dynamic(() => import('../../components/SamplePlayer'), { ssr: false })

const styles = {
	error: {
		textAlign: 'center',
		marginY: 4,
	},
	title: {
		textTransform: 'uppercase',
		fontStyle: 'italic',
		fontWeight: 900,
		mb: 2,
		display: 'flex',
		alignItems: 'center',
	},
	desc: {
		color: '#777',
		fontSize: '18px',
		mb: 2,
		fontWeight: 300,
	},
	metadataWrap: {
		mb: 3,
	},
	metadata: {
		display: 'inline-block',
		mr: 5,
	},
	metadataKey: {
		mr: 1,
		display: 'inline-block',
		color: '#a8a8a8',
	},
	divider: {
		my: 3,
		borderColor: '#ccc',
	},
}

const propTypes = {
	data: PropTypes.shape({
		createdAt: PropTypes.string.isRequired,
		audioUrl: PropTypes.string.isRequired,
	}),
}

type SampleDetailsPageProps = PropTypes.InferProps<typeof propTypes>

const SampleDetailsPage: NextPage<SampleDetailsPageProps> = props => {
	const { data } = props

	console.log({ data })

	return (
		<>
			<Head>
				<title>PolyEcho | Sample Details</title>
				<meta name="description" content="A hackathon music app" />
				<link rel="icon" href="/favicon.ico" />
			</Head>

			<AppHeader />

			<main id="app-main">
				<Container maxWidth="xl">
					<Typography variant="h4" component="h2" sx={styles.title}>
						Sample Details
					</Typography>
					{data ? (
						<>
							<Typography sx={styles.desc}>
								This is a PolyEcho sample that has been uploaded through our platform and is stored using NFT.storage.
							</Typography>
							<Box sx={styles.metadataWrap}>
								<Typography sx={styles.metadata}>
									<Typography component="span" sx={styles.metadataKey}>
										Created On:
									</Typography>
									{data.createdAt}
								</Typography>
								<Typography sx={styles.metadata}>
									<Typography component="span" sx={styles.metadataKey}>
										Stored At:
									</Typography>
									<Link href={data.audioUrl}>View on IPFS</Link>
								</Typography>
							</Box>
							<Divider light sx={styles.divider} />
							<SamplePlayer idx={1} details={data} showEyebrow={false} />
						</>
					) : (
						// <SamplePlayer idx={1} details={data} />
						<Typography sx={styles.error} color="error">
							Sorry, no details were found for this sample.
						</Typography>
					)}
				</Container>
			</main>

			<AppFooter />
		</>
	)
}

SampleDetailsPage.propTypes = propTypes

export const getServerSideProps: GetServerSideProps = async context => {
	const sampleId = context.query.id
	const res = await get(`/samples/${sampleId}`)
	const data: ISampleDoc | null = res.success ? res.data : null
	return {
		props: {
			data,
		},
	}
}

export default SampleDetailsPage
