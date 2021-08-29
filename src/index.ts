import 'isomorphic-fetch'

export interface File {
    url: string,
    shortName: string,
    originalName: string,
    mimeType: string,
    uncachedHits: number,
    updatedAt: number,
    size: number,
    parent?: string
}

export interface Folder {
    id: string,
    name: string,
    parent?: string
}

export type User = {
    id: string,
    name: string,
    email?: string,
    admin: boolean,
    usage: number,
    preferredDomain: string
}

export type UsageInfo = {
    username: string,
    usage: number,
    email: string
}

export class PatClient {
    private baseUrl: string
    private token?: string

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl ?? 'https://pat.doggo.ninja'
    }

    authenticate(token?: string) {
        this.token = token
    }

    async files(parent: string | undefined): Promise<File[]> {
        return await this.makeRequest('get', '/v1/files', { parent })
    }

    async moveFile(shortName: string, details: { originalName?: string, parent?: string | undefined }): Promise<File> {
        return await this.makeRequest('post', '/v1/files/move', {}, {
            shortName,
            ...details,
            forceMove: 'parent' in details
        })
    }

    async getFile(shortName: string): Promise<File> {
        return await this.makeRequest('get', `/v1/file/${encodeURIComponent(shortName)}`)
    }

    async deleteFile(shortName: string): Promise<File> {
        return await this.makeRequest('delete', `/v1/file/${encodeURIComponent(shortName)}`)
    }

    async folders(parent: string | undefined): Promise<Folder[]> {
        return await this.makeRequest('get', '/v1/folders', { parent })
    }

    async createFolder(name: string, parent: string | undefined) {
        return await this.makeRequest('post', '/v1/folders/create', {}, { name, parent })
    }

    async moveFolder(id: string, details: { name?: string, parent?: string | undefined }): Promise<File> {
        return await this.makeRequest('post', '/v1/folders/move', {}, {
            id,
            ...details,
            forceMove: 'parent' in details
        })
    }

    async getFolder(id: string): Promise<Folder[]> {
        return await this.makeRequest('get', `/v1/folder/${encodeURIComponent(id)}`)
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

    async makeRequest<Type = {}>(
        method: 'get' | 'post' | 'put' | 'delete',
        path: string,
        query: Record<string, string | undefined> = {},
        body?: Record<string, unknown>
    ): Promise<Type> {
        const headers: HeadersInit = {
            'Accept': 'application/json'
        }
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`
        if (body) headers['Content-Type'] = 'application/json'

        const url = new URL(this.baseUrl.concat(path))
        for (const [ key, value ] of Object.entries(query)) {
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