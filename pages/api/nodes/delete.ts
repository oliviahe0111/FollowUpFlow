import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nodeId } = req.body;

    if (!nodeId) {
      return res.status(400).json({ error: 'Node ID is required' });
    }

    // Start a transaction-like sequence
    // 1. Load the target node and validate
    const targetNode = await prisma.node.findUnique({
      where: { id: nodeId }
    });

    if (!targetNode) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // Only allow deletion of question nodes
    if (!targetNode.type.toString().includes('question')) {
      return res.status(400).json({ error: 'Can only delete question nodes' });
    }

    const targetParentId = targetNode.parentId;
    const targetRootId = targetNode.rootId;

    // 2. Find the paired AI answer node
    const answerNode = await prisma.node.findFirst({
      where: {
        parentId: nodeId,
        type: {
          in: ['ai_answer', 'followup_answer']
        }
      }
    });

    // 3. Find all follow-up children that need reparenting
    const followupChildren = await prisma.node.findMany({
      where: {
        parentId: answerNode?.id || nodeId,
        type: 'followup_question'
      }
    });

    // 4. Reparent follow-up children
    if (followupChildren.length > 0) {
      for (const child of followupChildren) {
        let newParentId = targetParentId;
        let newRootId = targetRootId;

        // If no parent, promote to root
        if (!targetParentId) {
          newParentId = null;
          newRootId = child.id;
        }

        await prisma.node.update({
          where: { id: child.id },
          data: {
            parentId: newParentId,
            rootId: newRootId
          }
        });
      }
    }

    // 5. Delete the answer node first (if it exists)
    if (answerNode) {
      await prisma.node.delete({
        where: { id: answerNode.id }
      });
    }

    // 6. Delete the question node
    await prisma.node.delete({
      where: { id: nodeId }
    });

    // 7. Clean up edges (should happen automatically via CASCADE, but let's be explicit)
    await prisma.edge.deleteMany({
      where: {
        OR: [
          { sourceId: nodeId },
          { targetId: nodeId },
          { sourceId: answerNode?.id || '' },
          { targetId: answerNode?.id || '' }
        ]
      }
    });

    return res.status(200).json({
      ok: true,
      deletedNodes: [nodeId, answerNode?.id].filter(Boolean),
      reparentedChildren: followupChildren.map(c => c.id)
    });

  } catch (error) {
    console.error('Delete operation failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}