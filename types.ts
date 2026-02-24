export interface Image {
	url: string
	caption?: string
}

export interface Person {
	name: string
	gender?: 'male' | 'female'
	birthdate?: Date
	wiki_url: string
	images: Image[]
}
