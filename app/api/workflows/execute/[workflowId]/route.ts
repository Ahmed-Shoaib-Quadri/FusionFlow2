import { currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { executeWorkflow } from '@/lib/workflow-runner'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { workflowId } = await params
  const workflow = await db.workflows.findFirst({
    where: {
      id: workflowId,
      userId: user.id,
    },
  })

  if (!workflow) {
    return NextResponse.json({ message: 'Workflow not found' }, { status: 404 })
  }

  const result = await executeWorkflow({
    workflow,
    triggerType: 'manual',
  })

  return NextResponse.json(result, { status: result.status === 'failed' ? 400 : 200 })
}
