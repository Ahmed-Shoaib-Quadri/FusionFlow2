"use server"

import { db } from "@/lib/db";
import { Option } from "@/store";
import { auth, currentUser } from "@clerk/nextjs/server";

export const getGoogleListener = async () => {
    const authUser = await currentUser();
    if(authUser){
        const listener = await db.user.findUnique({
            where:{
                clerkId: authUser.id,
            },
            select: {
                googleResourceId: true,
            },
        })
        if(listener) return listener;
    }
} 

export const onFlowPublish = async (workflowId: string, state: boolean) => {
    console.log(state);
    const published = await db.workflows.update({
        where: {
            id: workflowId,
        },
        data: {
            publish: state,
        },
    })

    if(published.publish) return 'Workflow published'
    return 'Workflow not published'
}

export const onSaveWorkflow = async (
  workflowId: string,
  nodes: any[],
  edges: any[]
) => {
  try {
    const response = await db.workflows.update({
      where: {
        id: workflowId,
      },
      data: {
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
      },
    })

    if (response) {
      return { message: 'Workflow saved successfully' }
    }
    return { message: 'Failed to save workflow' }
  } catch (error) {
    console.error('Error saving workflow:', error)
    return { message: 'Error saving workflow', error: error.message }
  }
}

export const onCreateNodeTemplate = async (
  content: string,
  type: string,
  workflowId: string,
  channels?: Option[],
  accessToken?: string,
  notionDbId?: string
) => {
  if (type === 'Discord') {
    const response = await db.workflows.update({
      where: {
        id: workflowId,
      },
      data: {
        discordTemplate: content,
      },
    })

    if (response) {
      return 'Discord template saved'
    }
  }
  if (type === 'Slack') {
    const response = await db.workflows.update({
      where: {
        id: workflowId,
      },
      data: {
        slackTemplate: content,
        slackAccessToken: accessToken,
      },
    })

    if (response) {
      const channelList = await db.workflows.findUnique({
        where: {
          id: workflowId,
        },
        select: {
          slackChannels: true,
        },
      })

      if (channelList) {
        //remove duplicates before insert
        const NonDuplicated = channelList.slackChannels.filter(
          (channel) => channel !== channels![0].value
        )

        NonDuplicated!
          .map((channel) => channel)
          .forEach(async (channel) => {
            await db.workflows.update({
              where: {
                id: workflowId,
              },
              data: {
                slackChannels: {
                  push: channel,
                },
              },
            })
          })

        return 'Slack template saved'
      }
      channels!
        .map((channel) => channel.value)
        .forEach(async (channel) => {
          await db.workflows.update({
            where: {
              id: workflowId,
            },
            data: {
              slackChannels: {
                push: channel,
              },
            },
          })
        })
      return 'Slack template saved'
    }
  }

  if (type === 'Notion') {
    const response = await db.workflows.update({
      where: {
        id: workflowId,
      },
      data: {
        notionTemplate: content,
        notionAccessToken: accessToken,
        notionDbId: notionDbId,
      },
    })

    if (response) return 'Notion template saved'
  }
}

export const onGetWorkflows = async () => {
  const user = await currentUser();
  if(user) {
    const workflow = await db.workflows.findMany({
      where: {
        userId: user.id,
      },
    })

    if(workflow) return workflow;
  }
}

export const onCreateWorkflow = async (name: string, description: string) => {
  const user = await currentUser()

  if (user) {
    //create new workflow
    const workflow = await db.workflows.create({
      data: {
        userId: user.id,
        name,
        description,
      },
    })

    if (workflow) return { message: 'workflow created' }
    return { message: 'Oops! try again' }
  }
}

export const onGetNodesEdges = async (flowId: string) => {
  const nodesEdges = await db.workflows.findUnique({
    where: {
      id: flowId,
    },
    select: {
      nodes: true,
      edges: true,
    },
  });
  if(nodesEdges?.nodes && nodesEdges?.edges) return nodesEdges;
}

export const onDeleteWorkflow = async (workflowId: string) => {
  try {
    const user = await currentUser()
    if (!user) return { message: 'User not authenticated' }

    const deleted = await db.workflows.delete({
      where: {
        id: workflowId,
        userId: user.id, // Ensure user can only delete their own workflows
      },
    })

    if (deleted) {
      return { message: 'Workflow deleted successfully' }
    }
    return { message: 'Failed to delete workflow' }
  } catch (error) {
    console.error('Error deleting workflow:', error)
    return { message: 'Error deleting workflow', error: error.message }
  }
}

export const onDuplicateWorkflow = async (workflowId: string) => {
  try {
    const user = await currentUser()
    if (!user) return { message: 'User not authenticated' }

    // Get the original workflow
    const originalWorkflow = await db.workflows.findUnique({
      where: {
        id: workflowId,
        userId: user.id,
      },
    })

    if (!originalWorkflow) {
      return { message: 'Workflow not found' }
    }

    // Create a duplicate with "Copy" suffix
    const duplicated = await db.workflows.create({
      data: {
        userId: user.id,
        name: `${originalWorkflow.name} (Copy)`,
        description: originalWorkflow.description,
        nodes: originalWorkflow.nodes,
        edges: originalWorkflow.edges,
        discordTemplate: originalWorkflow.discordTemplate,
        notionTemplate: originalWorkflow.notionTemplate,
        slackTemplate: originalWorkflow.slackTemplate,
        slackChannels: originalWorkflow.slackChannels,
        slackAccessToken: originalWorkflow.slackAccessToken,
        notionAccessToken: originalWorkflow.notionAccessToken,
        notionDbId: originalWorkflow.notionDbId,
        flowPath: originalWorkflow.flowPath,
        cronPath: originalWorkflow.cronPath,
        publish: false, // Always start as unpublished
      },
    })

    if (duplicated) {
      return { message: 'Workflow duplicated successfully', workflowId: duplicated.id }
    }
    return { message: 'Failed to duplicate workflow' }
  } catch (error) {
    console.error('Error duplicating workflow:', error)
    return { message: 'Error duplicating workflow', error: error.message }
  }
}