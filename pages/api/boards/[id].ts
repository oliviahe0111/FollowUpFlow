import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { createServerClient } from '@supabase/ssr';

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

    if (req.method === 'DELETE') {
      // Get current user session
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.query;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Board ID is required' });
      }

      // Check if the board exists and is owned by the current user
      const board = await prisma.board.findUnique({
        where: { id }
      });

      if (!board) {
        return res.status(404).json({ error: 'Board not found' });
      }

      // Check ownership - only the owner can delete their board
      const boardOwnerId = (board as any).ownerId;
      if (boardOwnerId !== user.id) {
        return res.status(403).json({ error: 'You can only delete your own boards' });
      }

      // Delete the board (this will cascade delete nodes and edges due to the schema)
      await prisma.board.delete({
        where: { id }
      });

      return res.status(200).json({ message: 'Board deleted successfully' });
    }

    res.setHeader('Allow', 'DELETE');
    return res.status(405).end();
  } catch (e: any) {
    console.error('delete board api error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
}