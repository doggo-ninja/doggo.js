import 'isomorphic-unfetch';

export interface File {
  url: string;
  shortName: string;
  originalName: string;
  mimeType: string;
  uncachedHits: number;
  updatedAt: number;
  size: number;
  parent?: string;
  private: boolean;
  ephemeralTimestamp: number | null;
  hasPassword: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parent?: string;
}

export type User = {
  id: string;
  name: string;
  email?: string;
  admin: boolean;
  usage: number;
  preferredDomain: string;
};

export type UsageInfo = {
  username: string;
  usage: number;
  email: string;
};

export class PatClient {
  private baseUrl: string;
  token?: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? 'https://pat.doggo.ninja';
  }

  async files(parent: string | undefined): Promise<File[]> {
    return await this.makeRequest('get', '/v1/files', { parent });
  }

  async upload(
    file: globalThis.File,
    parent: string | undefined,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<File> {
    if (typeof 'window' === 'undefined') {
      throw new Error('File uploads only supported in browser');
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', event => {
        onProgress && onProgress(event.loaded, event.total);
      });

      xhr.addEventListener('readystatechange', () => {
        if (xhr.readyState === 4) {
          const body = xhr.responseText;
          try {
            const json = JSON.parse(body);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(json);
            } else {
              reject(
                new Error(json.message || xhr.statusText || 'No error info')
              );
            }
          } catch {
            reject(new Error('Unable to parse json'));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('An unexpected error occurred'));
      });

      const url = new URL(`${this.baseUrl}/v1/upload`);
      if (parent) url.searchParams.set('parent', parent);
      url.searchParams.set('mimeType', file.type);
      if (file.name) url.searchParams.set('originalName', file.name);

      xhr.open('POST', url.toString());
      xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.send(file);
    });
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
    );
    return downloadToken;
  }

  async updateFileSharing(
    isPrivate: boolean,
    details: { ephemeralTimestamp: number | null; password: string | boolean }
  ): Promise<File> {
    return await this.makeRequest(
      'post',
      '/v1/files/sharing',
      {},
      { private: isPrivate, ...details }
    );
  }

  async moveFile(
    shortName: string,
    details: { originalName?: string; parent?: string | undefined },
    copy?: boolean
  ): Promise<File> {
    return await this.makeRequest(
      'post',
      '/v1/files/move',
      {},
      {
        shortName,
        ...details,
        forceMove: 'parent' in details,
        copy,
      }
    );
  }

  async getFile(shortName: string): Promise<File> {
    return await this.makeRequest(
      'get',
      `/v1/file/${encodeURIComponent(shortName)}`
    );
  }

  async deleteFile(shortName: string): Promise<File> {
    return await this.makeRequest(
      'delete',
      `/v1/file/${encodeURIComponent(shortName)}`
    );
  }

  async folders(parent: string | undefined): Promise<Folder[]> {
    return await this.makeRequest('get', '/v1/folders', { parent });
  }

  async createFolder(
    name: string,
    parent: string | undefined
  ): Promise<Folder> {
    return await this.makeRequest(
      'post',
      '/v1/folders/create',
      {},
      { name, parent }
    );
  }

  async moveFolder(
    id: string,
    details: { name?: string; parent?: string | undefined }
  ): Promise<File> {
    return await this.makeRequest(
      'post',
      '/v1/folders/move',
      {},
      {
        id,
        ...details,
        forceMove: 'parent' in details,
      }
    );
  }

  async getFolder(id: string): Promise<Folder[]> {
    return await this.makeRequest(
      'get',
      `/v1/folder/${encodeURIComponent(id)}`
    );
  }

  async checkAuth(): Promise<boolean> {
    try {
      await this.makeRequest('get', '/v1/auth/check');
      return true;
    } catch {
      return false;
    }
  }

  async login(
    username: string,
    password: string
  ): Promise<{ sessionToken: string; expiration: Date }> {
    const response = await this.makeRequest<{
      sessionToken: string;
      expiration: number;
    }>(
      'post',
      '/v1/auth/login',
      {},
      {
        name: username,
        password,
      }
    );
    return {
      sessionToken: response.sessionToken,
      expiration: new Date(response.expiration),
    };
  }

  async resetPassword(nameOrEmail: string): Promise<void> {
    await this.makeRequest('post', '/v1/auth/reset', {}, { nameOrEmail });
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
        regenerateAccessToken,
      }
    );
  }

  async invalidateSession(): Promise<void> {
    await this.makeRequest('get', '/v1/auth/invalidate');
  }

  async regenerateAccessToken(): Promise<string> {
    const { newToken } = await this.makeRequest<{ newToken: string }>(
      'get',
      '/v1/auth/regenerate'
    );
    return newToken;
  }

  async me(): Promise<User> {
    return await this.makeRequest('get', '/v1/me');
  }

  async setDomain(domain: 'doggo.ninja' | 'ninja.dog'): Promise<User> {
    return await this.makeRequest('post', '/v1/domain', {}, { domain });
  }

  async adminUsage(): Promise<UsageInfo[]> {
    return await this.makeRequest('get', '/v1/admin/usage');
  }

  async makeUser(username: string, email: string): Promise<void> {
    await this.makeRequest(
      'post',
      '/v1/admin/mkuser',
      {},
      {
        name: username,
        email,
      }
    );
  }

  async makeRequest<Type = {}>(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    query: Record<string, string | undefined> = {},
    body?: Record<string, unknown>
  ): Promise<Type> {
    const headers: HeadersInit = {
      Accept: 'application/json',
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (body) headers['Content-Type'] = 'application/json';

    const url = new URL(this.baseUrl.concat(path));
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let message;
      try {
        message = (await res.json()).message;
      } catch {
        message = res.statusText;
      }
      message = message ?? 'No error info';
      throw new Error(message);
    }

    const json = await res.json();
    return json as Type;
  }
}
