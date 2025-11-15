export interface File {
	url: string
	shortName: string
	originalName: string
	mimeType: string
	uncachedHits: number
	size: number
	parentId: string | null
	isPrivate: boolean
	privatesAt: number | null
	hasPassword: boolean
	updatedAt: number
	createdAt: number
}

export interface Folder {
	id: string
	name: string
	parentId: string | null
	createdAt: number
}

export type User = {
	id: string
	name: string
	email: string | null
	isAdmin: boolean
	usage: number
	preferredDomain: string
	createdAt: number
}

export type UsageInfo = {
	username: string
	usage: number
	email: string
}

export class PatClient {
	private baseUrl: string
	token?: string

	constructor(baseUrl?: string) {
		this.baseUrl = baseUrl ?? 'https://pat.doggo.ninja'
	}

	async files(parentId: string | null): Promise<File[]> {
		return await this.makeRequest('get', '/v1/files', { parentId })
	}

	async recentFiles(count: number): Promise<File[]> {
		return await this.makeRequest('get', '/v1/files', { count: count.toString() })
	}

	async upload(
		file: globalThis.File,
		parentId: string | null,
		onProgress?: (loaded: number, total: number) => void
	): Promise<File> {
		const url = new URL(`${this.baseUrl}/v1/upload`)
		if (parentId) url.searchParams.set('parentId', parentId)
		url.searchParams.set('mimeType', file.type)
		if (file.name) url.searchParams.set('originalName', file.name)

		return await this.makeUploadRequest(
			'post',
			url.toString(),
			file,
			onProgress
		)
	}

	async replace(
		shortName: string,
		file: globalThis.File,
		onProgress?: (loaded: number, total: number) => void
	): Promise<File> {
		const url = new URL(
			`${this.baseUrl}/v1/file/${encodeURIComponent(shortName)}`
		)
		url.searchParams.set('mimeType', file.type)
		if (file.name) url.searchParams.set('originalName', file.name)

		return await this.makeUploadRequest('put', url.toString(), file, onProgress)
	}

	async getDownloadToken(
		shortName: string,
		password?: string
	): Promise<string> {
		const { downloadToken } = await this.makeRequest<{ downloadToken: string }>(
			'post',
			'/v1/files/token',
			{},
			{ shortName, password }
		)
		return downloadToken
	}

	async updateFileSharing(
		shortName: string,
		isPrivate: boolean,
		details: { privatesAt: number | null; password: string | boolean }
	): Promise<File> {
		return await this.makeRequest(
			'post',
			'/v1/files/sharing',
			{},
			{ shortName, private: isPrivate, ...details }
		)
	}

	async moveFile(
		shortName: string,
		details: { originalName?: string; parentId?: string | null },
		copy?: boolean
	): Promise<File> {
		return await this.makeRequest(
			'post',
			'/v1/files/move',
			{},
			{
				shortName,
				...details,
				forceMove: 'parentId' in details,
				copy
			}
		)
	}

	async getFile(shortName: string): Promise<File> {
		return await this.makeRequest(
			'get',
			`/v1/file/${encodeURIComponent(shortName)}`
		)
	}

	async deleteFile(shortName: string): Promise<File> {
		return await this.makeRequest(
			'delete',
			`/v1/file/${encodeURIComponent(shortName)}`
		)
	}

	async deleteFolder(id: string): Promise<File> {
		return await this.makeRequest(
			'delete',
			`/v1/folder/${encodeURIComponent(id)}`
		)
	}

	async folders(parentId: string | null): Promise<Folder[]> {
		return await this.makeRequest('get', '/v1/folders', { parentId })
	}

	async createFolder(
		name: string,
		parentId: string | null
	): Promise<Folder> {
		return await this.makeRequest(
			'post',
			'/v1/folders/create',
			{},
			{ name, parentId }
		)
	}

	async moveFolder(
		id: string,
		details: { name?: string; parentId?: string | null }
	): Promise<File> {
		return await this.makeRequest(
			'post',
			'/v1/folders/move',
			{},
			{
				id,
				...details,
				forceMove: 'parentId' in details
			}
		)
	}

	async getFolder(id: string): Promise<Folder[]> {
		return await this.makeRequest('get', `/v1/folder/${encodeURIComponent(id)}`)
	}

	async checkAuth(): Promise<boolean> {
		try {
			await this.makeRequest('get', '/v1/auth/check')
			return true
		} catch {
			return false
		}
	}

	async login(
		username: string,
		password: string
	): Promise<{ sessionToken: string; expiration: Date }> {
		const response = await this.makeRequest<{
			sessionToken: string
			expiration: number
		}>(
			'post',
			'/v1/auth/login',
			{},
			{
				name: username,
				password
			}
		)
		return {
			sessionToken: response.sessionToken,
			expiration: new Date(response.expiration)
		}
	}

	async resetPassword(nameOrEmail?: string): Promise<{ censoredEmail: string }> {
		return await this.makeRequest('post', '/v1/auth/reset', {}, { nameOrEmail })
	}

	async completeResetPassword(
		resetToken: string,
		newPassword: string,
		regenerateAccessToken: boolean
	): Promise<void> {
		await this.makeRequest(
			'post',
			'/v1/auth/reset/complete',
			{},
			{
				resetToken,
				newPassword,
				regenerateAccessToken
			}
		)
	}

	async invalidateSession(): Promise<void> {
		await this.makeRequest('get', '/v1/auth/invalidate')
	}

	async regenerateAccessToken(): Promise<string> {
		const { newToken } = await this.makeRequest<{ newToken: string }>(
			'get',
			'/v1/auth/regenerate'
		)
		return newToken
	}

	async me(): Promise<User> {
		return await this.makeRequest('get', '/v1/me')
	}

	async setDomain(domain: 'doggo.ninja' | 'ninja.dog'): Promise<User> {
		return await this.makeRequest('post', '/v1/domain', {}, { domain })
	}

	async adminUsage(): Promise<UsageInfo[]> {
		return await this.makeRequest('get', '/v1/admin/usage')
	}

	async makeUser(username: string, email: string): Promise<void> {
		await this.makeRequest(
			'post',
			'/v1/admin/mkuser',
			{},
			{
				name: username,
				email
			}
		)
	}

	async makeUploadRequest<Type = {}>(
		method: 'post' | 'put' | 'delete',
		url: string,
		file: globalThis.File,
		onProgress?: (loaded: number, total: number) => void
	): Promise<Type> {
		if (typeof 'window' === 'undefined') {
			throw new Error('File uploads only supported in browser')
		}

		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest()

			xhr.upload.addEventListener('progress', event => {
				onProgress && onProgress(event.loaded, event.total)
			})

			xhr.addEventListener('readystatechange', () => {
				if (xhr.readyState === 4) {
					const body = xhr.responseText
					try {
						const json = JSON.parse(body)
						if (xhr.status >= 200 && xhr.status < 300) {
							resolve(json)
						} else {
							reject(
								new Error(json.message || xhr.statusText || 'No error info')
							)
						}
					} catch {
						reject(new Error('Unable to parse json'))
					}
				}
			})

			xhr.addEventListener('error', () => {
				reject(new Error('An unexpected error occurred'))
			})

			xhr.open(method, url)
			xhr.setRequestHeader('Authorization', `Bearer ${this.token}`)
			xhr.setRequestHeader('Content-Type', 'application/octet-stream')
			xhr.send(file)
		})
	}

	async makeRequest<Type = {}>(
		method: 'get' | 'post' | 'put' | 'delete',
		path: string,
		query: Record<string, string | null> = {},
		body?: Record<string, unknown>
	): Promise<Type> {
		const headers: HeadersInit = {
			Accept: 'application/json'
		}
		if (this.token) headers['Authorization'] = `Bearer ${this.token}`
		if (body) headers['Content-Type'] = 'application/json'

		const url = new URL(this.baseUrl.concat(path))
		for (const [key, value] of Object.entries(query)) {
			if (value) url.searchParams.set(key, value)
		}

		const res = await fetch(url.toString(), {
			method,
			headers,
			body: JSON.stringify(body)
		})

		if (!res.ok) {
			let message
			try {
				message = (await res.json()).message
			} catch {
				message = res.statusText
			}
			message = message ?? 'No error info'
			throw new Error(message)
		}

		const json = await res.json()
		return json as Type
	}
}
