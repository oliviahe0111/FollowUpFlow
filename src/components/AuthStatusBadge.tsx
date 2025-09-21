'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { User } from '@supabase/supabase-js'

export default function AuthStatusBadge() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback',
        queryParams: { 
          prompt: 'select_account' 
        }
      }
    })
  }

  const handleSignOut = async () => {
    try {
      // Clear server-side session first
      await fetch('/auth/signout', { method: 'POST' })
      
      // Clear client-side session
      await supabase.auth.signOut()
      
      // Force refresh to trigger middleware redirect
      router.refresh()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
      // Fallback: still try client-side signout
      await supabase.auth.signOut()
      router.push('/login')
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-600">
        Loading...
      </div>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {user.user_metadata?.avatar_url && (
          <img
            src={user.user_metadata.avatar_url}
            alt="Avatar"
            className="w-8 h-8 rounded-full"
          />
        )}
        <span className="text-sm text-gray-700">
          {user.user_metadata?.full_name || user.email}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="text-xs"
        >
          Sign out
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={handleSignIn} size="sm">
      Sign in with Google
    </Button>
  )
}