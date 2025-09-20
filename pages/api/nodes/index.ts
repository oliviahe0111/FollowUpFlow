import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

const toSnake = (n: any) => ({
  id: n.id,
  board_id: n.boardId,
  type: n.type,
  content: n.content,
  root_id: n.rootId,
  parent_id: n.parentId,
  x: n.x, y: n.y, width: n.width, height: n.height,
  created_at: n.createdAt, updated_at: n.updatedAt,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const board_id = req.query.board_id as string;
      if (!board_id) return res.status(400).json({ error: 'board_id required' });
      const nodes = await prisma.node.findMany({
        where: { boardId: board_id },
        orderBy: { createdAt: 'asc' }
      });
      return res.status(200).json(nodes.map(toSnake));
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.board_id || !b.type || typeof b.content !== 'string') {
        return res.status(400).json({ error: 'board_id, type, content required' });
      }
      const node = await prisma.node.create({
        data: {
          boardId: b.board_id,
          type: b.type,
          content: b.content,
          rootId: b.root_id ?? null,
          parentId: b.parent_id ?? null,
          x: Number.isFinite(b.x) ? Math.floor(b.x) : 0,
          y: Number.isFinite(b.y) ? Math.floor(b.y) : 0,
          width: Number.isFinite(b.width) ? Math.floor(b.width) : 320,
          height: Number.isFinite(b.height) ? Math.floor(b.height) : 140,
        },
      });
      return res.status(201).json(toSnake(node));
    }

    if (req.method === 'PUT') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: 'id required' });

      const b = req.body || {};
      const data: any = {};
      if ('content' in b) data.content = b.content;
      if ('type' in b) data.type = b.type;
      if ('root_id' in b) data.rootId = b.root_id ?? null;
      if ('parent_id' in b) data.parentId = b.parent_id ?? null;
      if ('x' in b) data.x = Math.floor(b.x);
      if ('y' in b) data.y = Math.floor(b.y);
      if ('width' in b) data.width = Math.floor(b.width);
      if ('height' in b) data.height = Math.floor(b.height);

      const node = await prisma.node.update({ where: { id }, data });
      return res.status(200).json(toSnake(node));
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).end();
  } catch (e: any) {
    console.error('nodes api error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
}
