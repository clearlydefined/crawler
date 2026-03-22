// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { SpawnOptions } from 'child_process'
import type { DateTime } from 'luxon'

export function normalizePath(path: string): string
export function normalizePaths(paths: string[]): string[]
export function trimParents(path: string, parents?: string): string
export function trimAllParents(paths: string[], parents: string): string[]
export function isGitFile(file: string): boolean
export function extractDate(dateAndTime: string, formats?: string[]): DateTime | null
export function spawnPromisified(command: string, args: string[], options?: SpawnOptions): Promise<string>
