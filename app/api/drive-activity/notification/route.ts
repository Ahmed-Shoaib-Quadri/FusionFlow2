import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { executeWorkflow } from '@/lib/workflow-runner'
import {
  DEFAULT_DRIVE_EVENT_TYPES,
  getDriveTriggerEventTypes,
  getTriggerMetadata,
  parseWorkflowNodes,
} from '@/lib/workflow-definition'
import { clerkClient } from '@clerk/nextjs/server'
import { google } from 'googleapis'

type DriveChangeRecord = {
  removed?: boolean | null
  fileId?: string | null
  file?: {
    name?: string | null
    trashed?: boolean | null
    createdTime?: string | null
    modifiedTime?: string | null
  } | null
}

const NOTIFICATION_LOCK_TTL_MS = 10_000
const NOTIFICATION_DEDUPE_TTL_MS = 30_000

const inflightNotifications = new Map<string, number>()
const recentNotificationSignatures = new Map<string, number>()

const pruneExpiredEntries = () => {
  const now = Date.now()

  for (const [key, timestamp] of inflightNotifications.entries()) {
    if (now - timestamp > NOTIFICATION_LOCK_TTL_MS) {
      inflightNotifications.delete(key)
    }
  }

  for (const [key, timestamp] of recentNotificationSignatures.entries()) {
    if (now - timestamp > NOTIFICATION_DEDUPE_TTL_MS) {
      recentNotificationSignatures.delete(key)
    }
  }
}

const classifyDriveChange = (change: DriveChangeRecord) => {
  if (change.removed || change.file?.trashed) {
    return 'deleted' as const
  }

  const createdTime = change.file?.createdTime
  const modifiedTime = change.file?.modifiedTime

  if (createdTime && modifiedTime) {
    const createdAt = new Date(createdTime).getTime()
    const modifiedAt = new Date(modifiedTime).getTime()
    if (Number.isFinite(createdAt) && Number.isFinite(modifiedAt) && Math.abs(modifiedAt - createdAt) < 15000) {
      return 'created' as const
    }
  }

  return 'updated' as const
}

const getGoogleDriveChanges = async (userId: string, pageToken: string) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.OAUTH2_REDIRECT_URI
  )

  const client = await clerkClient()
  const tokenResponse = await client.users.getUserOauthAccessToken(userId, 'google')
  const accessToken = tokenResponse.data[0]?.token

  if (!accessToken) {
    throw new Error('Google OAuth token not found for user')
  }

  oauth2Client.setCredentials({
    access_token: accessToken,
  })

  const drive = google.drive({
    version: 'v3',
    auth: oauth2Client,
  })

  const changes: DriveChangeRecord[] = []
  let nextPageToken: string | undefined = pageToken
  let newStartPageToken = pageToken

  while (nextPageToken) {
    try {
      const response = await drive.changes.list({
        pageToken: nextPageToken,
        spaces: 'drive',
        includeRemoved: true,
        fields:
          'nextPageToken,newStartPageToken,changes(fileId,removed,file(name,trashed,createdTime,modifiedTime))',
      })

      changes.push(...((response.data.changes as DriveChangeRecord[]) || []))
      nextPageToken = response.data.nextPageToken || undefined
      newStartPageToken = response.data.newStartPageToken || newStartPageToken

      if (!response.data.nextPageToken) {
        break
      }
    } catch (error: any) {
      const status = error?.code || error?.response?.status
      if (status === 410) {
        const freshToken = await drive.changes.getStartPageToken({})
        newStartPageToken = freshToken.data.startPageToken || pageToken
        nextPageToken = undefined
        break
      }

      throw error
    }
  }

  return {
    changes,
    nextPageToken: newStartPageToken,
  }
}

const dedupeDriveChanges = (changes: DriveChangeRecord[]) => {
  const latestByFileAndType = new Map<string, DriveChangeRecord>()

  changes.forEach((change) => {
    const eventType = classifyDriveChange(change)
    const fileId = change.fileId || change.file?.name || 'unknown-file'
    latestByFileAndType.set(`${fileId}:${eventType}`, change)
  })

  return Array.from(latestByFileAndType.values())
}

const buildNotificationSignature = (changes: DriveChangeRecord[]) =>
  dedupeDriveChanges(changes)
    .map((change) => {
      const eventType = classifyDriveChange(change)
      const fileId = change.fileId || 'unknown-file'
      const fileName = change.file?.name || 'unknown-name'
      const modifiedTime = change.file?.modifiedTime || 'unknown-time'
      return `${eventType}:${fileId}:${fileName}:${modifiedTime}`
    })
    .sort()
    .join('|')

export async function POST() {
  const headersList = await headers()
  const channelResourceId = headersList.get('x-goog-resource-id')
  const resourceState = headersList.get('x-goog-resource-state')

  if (!channelResourceId) {
    return Response.json({ message: 'No resource ID' }, { status: 400 })
  }

  if (resourceState === 'sync') {
    return Response.json({ message: 'Drive listener synced' }, { status: 200 })
  }

  try {
    pruneExpiredEntries()

    if (inflightNotifications.has(channelResourceId)) {
      return Response.json(
        { message: 'Drive notification already being processed' },
        { status: 200 }
      )
    }

    inflightNotifications.set(channelResourceId, Date.now())

    const user = await db.user.findFirst({
      where: {
        googleResourceId: channelResourceId,
      },
      select: {
        id: true,
        clerkId: true,
        credits: true,
        LocalGoogleCredential: {
          select: {
            pageToken: true,
          },
        },
      },
    })

    if (!user) {
      return Response.json({ message: 'User not found' }, { status: 404 })
    }

    if (user.credits !== 'Unlimited' && parseInt(user.credits || '0', 10) <= 0) {
      return Response.json({ message: 'Insufficient credits' }, { status: 402 })
    }

    const currentPageToken = user.LocalGoogleCredential?.pageToken
    if (!currentPageToken) {
      return Response.json({ message: 'Drive listener is missing its page token' }, { status: 409 })
    }

    const { changes, nextPageToken } = await getGoogleDriveChanges(user.clerkId, currentPageToken)

    if (!changes.length) {
      return Response.json({ message: 'No new Drive changes' }, { status: 200 })
    }

    const uniqueChanges = dedupeDriveChanges(changes)
    const notificationSignature = `${user.clerkId}:${buildNotificationSignature(uniqueChanges)}`

    if (recentNotificationSignatures.has(notificationSignature)) {
      return Response.json(
        { message: 'Duplicate Drive notification skipped' },
        { status: 200 }
      )
    }

    await db.localGoogleCredential.updateMany({
      where: {
        userId: user.id,
      },
      data: {
        pageToken: nextPageToken,
      },
    })

    recentNotificationSignatures.set(notificationSignature, Date.now())

    const detectedEventTypes = Array.from(
      new Set(uniqueChanges.map(classifyDriveChange))
    )

    const workflows = await db.workflows.findMany({
      where: {
        userId: user.clerkId,
        publish: true,
      },
    })

    const googleDriveWorkflows = workflows.filter((workflow) => {
      const nodes = parseWorkflowNodes(workflow.nodes)
      const triggerMetadata = getTriggerMetadata(nodes)
      if (triggerMetadata.triggerType !== 'google_drive') {
        return false
      }

      const requiredEventTypes = getDriveTriggerEventTypes(nodes)
      const activeEventTypes =
        requiredEventTypes.length > 0 ? requiredEventTypes : DEFAULT_DRIVE_EVENT_TYPES

      return activeEventTypes.some((eventType) => detectedEventTypes.includes(eventType))
    })

    if (!googleDriveWorkflows.length) {
      return Response.json(
        {
          message: 'No workflows matched the detected Drive changes',
          detectedEventTypes,
        },
        { status: 200 }
      )
    }

    const executionResults = await Promise.all(
      googleDriveWorkflows.map((workflow) =>
        executeWorkflow({
          workflow,
          triggerType: 'google_drive',
        })
      )
    )

    const completedExecutions = executionResults.filter(
      (result) => result.status === 'completed'
    ).length

    if (completedExecutions > 0 && user.credits !== 'Unlimited') {
      const nextCredits = Math.max(
        0,
        parseInt(user.credits || '0', 10) - completedExecutions
      )

      await db.user.update({
        where: { clerkId: user.clerkId },
        data: { credits: `${nextCredits}` },
      })
    }

    return Response.json(
      {
        message: 'Workflows executed',
        detectedEventTypes,
        processedChanges: uniqueChanges.length,
        results: executionResults,
      },
      { status: 200 }
    )
  } catch (error) {
    return Response.json(
      {
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  } finally {
    inflightNotifications.delete(channelResourceId)
  }
}
