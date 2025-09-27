import { db } from '@/lib/db'
import { postContentToWebHook } from '@/app/(main)/(pages)/connections/_actions/discord-connection'
import { onCreateNewPageInDatabase } from '@/app/(main)/(pages)/connections/_actions/notion-connection'
import { postMessageToSlack } from '@/app/(main)/(pages)/connections/_actions/slack-connection'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const flowId = searchParams.get('flow_id')
  const currentIndex = searchParams.get('current_index')

  if (!flowId) {
    return Response.json({ message: 'Missing flow_id parameter' }, { status: 400 })
  }

  try {
    // Get the workflow
    const workflow = await db.workflows.findUnique({
      where: { id: flowId },
    })

    if (!workflow) {
      return Response.json({ message: 'Workflow not found' }, { status: 404 })
    }

    if (!workflow.cronPath) {
      return Response.json({ message: 'No cron path found' }, { status: 400 })
    }

    const remainingPath = JSON.parse(workflow.cronPath)
    let currentIndex = 0
    const results = []

    while (currentIndex < remainingPath.length) {
      const currentNode = remainingPath[currentIndex]
      console.log(`Executing delayed node: ${currentNode} at index ${currentIndex}`)

      try {
        switch (currentNode) {
          case 'Discord':
            const discordWebhook = await db.discordWebhook.findFirst({
              where: { userId: workflow.userId },
              select: { url: true },
            })
            
            if (discordWebhook && workflow.discordTemplate) {
              await postContentToWebHook(workflow.discordTemplate, discordWebhook.url)
              results.push({ node: 'Discord', status: 'success' })
            } else {
              results.push({ node: 'Discord', status: 'failed', reason: 'no_webhook_or_template' })
            }
            break

          case 'Slack':
            if (workflow.slackAccessToken && workflow.slackTemplate && workflow.slackChannels.length > 0) {
              const channels = workflow.slackChannels.map((channel) => ({
                label: '',
                value: channel,
              }))
              
              await postMessageToSlack(
                workflow.slackAccessToken,
                channels,
                workflow.slackTemplate
              )
              results.push({ node: 'Slack', status: 'success' })
            } else {
              results.push({ node: 'Slack', status: 'failed', reason: 'missing_config' })
            }
            break

          case 'Notion':
            if (workflow.notionAccessToken && workflow.notionDbId && workflow.notionTemplate) {
              await onCreateNewPageInDatabase(
                workflow.notionDbId,
                workflow.notionAccessToken,
                JSON.parse(workflow.notionTemplate)
              )
              results.push({ node: 'Notion', status: 'success' })
            } else {
              results.push({ node: 'Notion', status: 'failed', reason: 'missing_config' })
            }
            break

          case 'Wait':
            // Handle nested wait logic
            const cronResponse = await fetch('https://api.cron-job.org/jobs', {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${process.env.CRON_JOB_KEY!}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                job: {
                  url: `${process.env.NGROK_URI}/api/cron/wait?flow_id=${workflow.id}&current_index=${currentIndex}`,
                  enabled: 'true',
                  schedule: {
                    timezone: 'UTC',
                    expiresAt: 0,
                    hours: [-1],
                    mdays: [-1],
                    minutes: ['*****'],
                    months: [-1],
                    wdays: [-1],
                  },
                },
              }),
            })
            
            if (cronResponse.ok) {
              const remainingPathAfterWait = remainingPath.slice(currentIndex + 1)
              await db.workflows.update({
                where: { id: workflow.id },
                data: { cronPath: JSON.stringify(remainingPathAfterWait) },
              })
              results.push({ node: 'Wait', status: 'scheduled' })
              break // Exit the loop as we're waiting again
            } else {
              results.push({ node: 'Wait', status: 'failed', reason: 'cron_schedule_failed' })
            }
            break

          default:
            console.log(`Unknown node type: ${currentNode}`)
            results.push({ node: currentNode, status: 'failed', reason: 'unknown_node_type' })
            break
        }
      } catch (error) {
        console.error(`Error executing delayed node ${currentNode}:`, error)
        results.push({ 
          node: currentNode, 
          status: 'failed', 
          reason: 'execution_error', 
          error: error.message 
        })
      }

      currentIndex++
    }

    // Clear the cron path if execution is complete
    if (currentIndex >= remainingPath.length) {
      await db.workflows.update({
        where: { id: workflow.id },
        data: { cronPath: null },
      })
    }

    console.log('Delayed workflow execution completed:', results)
    
    return Response.json({
      message: 'Delayed workflow executed',
      results,
      workflowId: flowId,
    }, { status: 200 })

  } catch (error) {
    console.error('Error in cron wait handler:', error)
    return Response.json({
      message: 'Internal server error',
      error: error.message
    }, { status: 500 })
  }
} 