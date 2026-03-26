import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resumeDelayedWorkflow } from '@/lib/workflow-runner'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const flowId = searchParams.get('flow_id')

  if (!flowId) {
    return Response.json({ message: 'Missing flow_id parameter' }, { status: 400 })
  }

  try {
    const workflow = await db.workflows.findUnique({
      where: { id: flowId },
    })

    if (!workflow) {
      return Response.json({ message: 'Workflow not found' }, { status: 404 })
    }

    const result = await resumeDelayedWorkflow({
      workflow,
      triggerType: 'scheduled',
    })

    return Response.json(
      {
        message: 'Delayed workflow executed',
        ...result,
      },
      { status: result.status === 'failed' ? 400 : 200 }
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
