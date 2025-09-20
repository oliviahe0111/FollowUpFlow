import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

const toSnake = (e: any) => ({
  id: e.id,
  board_id: e.boardId,
  source_id: e.sourceId,
  target_id: e.targetId,
  created_at: e.createdAt,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const board_id = req.query.board_id as string;
      if (!board_id) return res.status(400).json({ error: 'board_id required' });
      const edges = await prisma.edge.findMany({
        where: { boardId: board_id },
        orderBy: { createdAt: 'asc' }
      });
      return res.status(200).json(edges.map(toSnake));
    }

    if (req.method === 'POST') {
      const { board_id, source_id, target_id } = req.body || {};
      if (!board_id || !source_id || !target_id) {
        return res.status(400).json({ error: 'board_id, source_id, target_id required' });
      }
      const edge = await prisma.edge.create({
        data: { boardId: board_id, sourceId: source_id, targetId: target_id },
      });
      return res.status(201).json(toSnake(edge));
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (e: any) {
    console.error('edges api error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
}
