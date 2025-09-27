import { postContentToWebHook } from '@/app/(main)/(pages)/connections/_actions/discord-connection'
import { onCreateNewPageInDatabase } from '@/app/(main)/(pages)/connections/_actions/notion-connection'
import { postMessageToSlack } from '@/app/(main)/(pages)/connections/_actions/slack-connection'
import { db } from '@/lib/db'
import { WorkflowExecutionService } from '@/lib/workflow-execution-service'
import axios from 'axios'
import { headers } from 'next/headers'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  console.log('🔴 Google Drive change detected')
  const headersList = await headers()
  let channelResourceId = headersList.get('x-goog-resource-id');

  if (!channelResourceId) {
    console.log('No resource ID found in headers')
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
      console.log('User not found for resource ID:', channelResourceId)
      return Response.json({ message: 'User not found' }, { status: 404 })
    }

    // Check credits
    if (user.credits !== 'Unlimited' && parseInt(user.credits!) <= 0) {
      console.log('Insufficient credits for user:', user.clerkId)
      return Response.json({ message: 'Insufficient credits' }, { status: 402 })
    }

    // Get all published workflows for this user
    const workflows = await db.workflows.findMany({
      where: {
        userId: user.clerkId,
        publish: true, // Only execute published workflows
      },
    })

    if (!workflows || workflows.length === 0) {
      console.log('No published workflows found for user:', user.clerkId)
      return Response.json({ message: 'No workflows to execute' }, { status: 200 })
    }

    // Execute each workflow
    const executionPromises = workflows.map(async (workflow) => {
      const startTime = new Date()
      let overallStatus: 'success' | 'failed' | 'partial' = 'success'
      let errorMessage: string | undefined
      const allResults = []

      try {
        console.log(`Executing workflow: ${workflow.name} (${workflow.id})`)
        
        if (!workflow.flowPath) {
          console.log(`No flow path found for workflow: ${workflow.id}`)
          await WorkflowExecutionService.logExecution({
            workflowId: workflow.id,
            userId: user.clerkId,
            status: 'failed',
            triggerType: 'google_drive',
            error: 'No flow path configured',
            startedAt: startTime,
          })
          return { workflowId: workflow.id, status: 'skipped', reason: 'no_flow_path' }
        }

        const flowPath = JSON.parse(workflow.flowPath)
        let currentIndex = 0
        const results = []

        while (currentIndex < flowPath.length) {
          const currentNode = flowPath[currentIndex]
          console.log(`Executing node: ${currentNode} at index ${currentIndex}`)

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
                  overallStatus = 'partial'
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
                  overallStatus = 'partial'
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
                  overallStatus = 'partial'
                }
                break

              case 'Wait':
                // Handle wait logic with cron job
                const cronResponse = await axios.put(
                  'https://api.cron-job.org/jobs',
                  {
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
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${process.env.CRON_JOB_KEY!}`,
                      'Content-Type': 'application/json',
                    },
                  }
                )
                
                if (cronResponse.status === 200) {
                  // Update workflow with remaining path
                  const remainingPath = flowPath.slice(currentIndex + 1)
                  await db.workflows.update({
                    where: { id: workflow.id },
                    data: { cronPath: JSON.stringify(remainingPath) },
                  })
                  results.push({ node: 'Wait', status: 'scheduled' })
                  break // Exit the loop as we're waiting
                } else {
                  results.push({ node: 'Wait', status: 'failed', reason: 'cron_schedule_failed' })
                  overallStatus = 'partial'
                }
                break

              default:
                console.log(`Unknown node type: ${currentNode}`)
                results.push({ node: currentNode, status: 'failed', reason: 'unknown_node_type' })
                overallStatus = 'partial'
                break
            }
          } catch (error) {
            console.error(`Error executing node ${currentNode}:`, error)
            results.push({ node: currentNode, status: 'failed', reason: 'execution_error', error: error.message })
            overallStatus = 'partial'
          }

          currentIndex++
        }

        // Log the execution
        await WorkflowExecutionService.logExecution({
          workflowId: workflow.id,
          userId: user.clerkId,
          status: overallStatus,
          triggerType: 'google_drive',
          results: results,
          error: errorMessage,
          startedAt: startTime,
        })

        // Deduct credits only if workflow completed successfully
        if (user.credits !== 'Unlimited') {
          await db.user.update({
            where: { clerkId: user.clerkId },
            data: { credits: `${parseInt(user.credits!) - 1}` },
          })
        }

        return { 
          workflowId: workflow.id, 
          status: 'completed', 
          results,
          creditsDeducted: user.credits !== 'Unlimited' ? 1 : 0
        }

      } catch (error) {
        console.error(`Error executing workflow ${workflow.id}:`, error)
        errorMessage = error.message
        
        // Log failed execution
        await WorkflowExecutionService.logExecution({
          workflowId: workflow.id,
          userId: user.clerkId,
          status: 'failed',
          triggerType: 'google_drive',
          error: errorMessage,
          startedAt: startTime,
        })
        
        return { 
          workflowId: workflow.id, 
          status: 'failed', 
          error: error.message 
        }
      }
    })

    const executionResults = await Promise.all(executionPromises)
    
    console.log('Workflow execution completed:', executionResults)
    
    return Response.json({
      message: 'Workflows executed',
      results: executionResults,
      userCredits: user.credits,
    }, { status: 200 })

  } catch (error) {
    console.error('Error in notification handler:', error)
    return Response.json({
      message: 'Internal server error',
      error: error.message
    }, { status: 500 })
  }
}