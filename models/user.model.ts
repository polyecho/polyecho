import mongoose from 'mongoose'
import type { ISampleDoc } from './sample.model'
import { sampleSchema } from './sample.model'

export interface IUser {
	_id: string
	displayName: string
	samples: ISampleDoc[]
}

// export interface IUserDoc extends Document, IUser {}

const userSchema = new mongoose.Schema<IUser>(
	{
		// Custom override of default _id - map to wallet/connected account address
		_id: {
			type: String,
			required: true,
			unique: true,
			// validate it is an ethereum-like address
		},
		displayName: {
			type: String,
			required: false,
			trim: true,
			minLength: 3,
			maxlength: 50,
		},
		samples: {
			type: [sampleSchema],
			required: false,
			default: [],
		},
	},
	{ timestamps: true },
)

export const User = mongoose.models.user || mongoose.model<IUser>('user', userSchema)
