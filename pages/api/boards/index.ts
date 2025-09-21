import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { createServerClient } from '@supabase/ssr';

const toSnake = (b: any) => ({
  id: b.id,
  title: b.title,
  description: b.description,
  created_at: b.createdAt,
  owner_id: (b as any).ownerId,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Create Supabase client for Pages API
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return Object.keys(req.cookies).map(name => ({
              name,
              value: req.cookies[name] || ''
            }))
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${options?.secure ? '; Secure' : ''}`)
            })
          },
        },
      }
    )

    if (req.method === 'GET') {
      // Get current user session
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        // Return empty array for unauthenticated users
        return res.status(200).json([]);
      }

      // Only return boards owned by the current user
      const boards = await prisma.board.findMany({
        where: { ownerId: user.id } as any,
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(boards.map(toSnake));
    }

    if (req.method === 'POST') {
      // Get current user session
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Only accept title and description from client
      const { title, description } = req.body || {};
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'title required' });
      }
      
      // Create board with ownerId set to authenticated user's UUID
      const board = await prisma.board.create({
        data: {
          title,
          description: description || '',
          ownerId: user.id,
        } as any,
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