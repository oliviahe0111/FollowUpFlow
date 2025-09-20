import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

const toSnake = (b: any) => ({
  id: b.id,
  title: b.title,
  description: b.description,
  created_at: b.createdAt,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const boards = await prisma.board.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(boards.map(toSnake));
    }

    if (req.method === 'POST') {
      const { title, description } = req.body || {};
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'title required' });
      }
      
      const board = await prisma.board.create({
        data: {
          title,
          description: description || '',
        },
      });
      return res.status(201).json(toSnake(board));
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (e: any) {
    console.error('boards api error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
}