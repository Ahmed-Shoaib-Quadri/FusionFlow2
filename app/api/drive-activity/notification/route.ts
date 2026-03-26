import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { executeWorkflow } from '@/lib/workflow-runner'
import { getTriggerMetadata, parseWorkflowNodes } from '@/lib/workflow-definition'

export async function POST() {
  const headersList = await headers()
  const channelResourceId = headersList.get('x-goog-resource-id')

  if (!channelResourceId) {
    return Response.json({ message: 'No resource ID' }, { status: 400 })
  }

  try {
    const user = await db.user.findFirst({
      where: {
        googleResourceId: channelResourceId,
      },
      select: { clerkId: true, credits: true },
    })

    if (!user) {
      return Response.json({ message: 'User not found' }, { status: 404 })
    }

    if (user.credits !== 'Unlimited' && parseInt(user.credits || '0', 10) <= 0) {
      return Response.json({ message: 'Insufficient credits' }, { status: 402 })
    }

    const workflows = await db.workflows.findMany({
      where: {
        userId: user.clerkId,
        publish: true,
      },
    })

    const googleDriveWorkflows = workflows.filter((workflow) => {
      const triggerMetadata = getTriggerMetadata(parseWorkflowNodes(workflow.nodes))
      return triggerMetadata.triggerType === 'google_drive'
    })

    if (!googleDriveWorkflows.length) {
      return Response.json({ message: 'No workflows to execute' }, { status: 200 })
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
  }
}
