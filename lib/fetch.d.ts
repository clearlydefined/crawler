// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

interface FetchRequest {
  method?: string
  url?: string
  uri?: string
  json?: boolean
  encoding?: null | string
  simple?: boolean
  headers?: Record<string, string>
  body?: any
  resolveWithFullResponse?: boolean
  [key: string]: any
}

interface FetchResponse {
  statusCode: number
  headers: Record<string, string | string[]>
  body: unknown
  request: object
}

export const defaultHeaders: Readonly<{ 'User-Agent': string }>

export function callFetch(request: FetchRequest, axiosInstance?: AxiosInstance): Promise<any>
export function callFetchWithRetry(
  url: string,
  options?: FetchRequest,
  retryOptions?: { maxAttempts?: number; [key: string]: any }
): Promise<FetchResponse>
export function withDefaults(opts: AxiosRequestConfig): (request: FetchRequest) => Promise<any>
export function getStream(opt: string | FetchRequest): Promise<AxiosResponse>
