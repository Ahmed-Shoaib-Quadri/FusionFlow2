import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { executeWorkflow } from '@/lib/workflow-runner'
import { getTriggerMetadata, parseWorkflowNodes } from '@/lib/workflow-definition'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const { workflowId } = await params
  const token = req.nextUrl.searchParams.get('token')

  const workflow = await db.workflows.findUnique({
    where: { id: workflowId },
  })

  if (!workflow || !workflow.publish) {
    return NextResponse.json({ message: 'Workflow not found' }, { status: 404 })
  }

  const triggerMetadata = getTriggerMetadata(parseWorkflowNodes(workflow.nodes))
  if (triggerMetadata.triggerType !== 'scheduled') {
    return NextResponse.json({ message: 'Scheduled trigger not enabled' }, { status: 400 })
  }

  if (!token || token !== triggerMetadata.webhookSecret) {
    return NextResponse.json({ message: 'Invalid schedule token' }, { status: 401 })
  }

  const result = await executeWorkflow({
    workflow,
    triggerType: 'scheduled',
  })

  return NextResponse.json(result, { status: result.status === 'failed' ? 400 : 200 })
}
