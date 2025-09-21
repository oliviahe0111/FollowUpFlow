'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import type { User } from '@supabase/supabase-js'

// Helper function to validate avatar URLs
const isValidAvatarUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url)
    // Only allow HTTPS and common avatar domains
    return (
      parsedUrl.protocol === 'https:' &&
      (parsedUrl.hostname.endsWith('.googleusercontent.com') ||
       parsedUrl.hostname.endsWith('.gravatar.com') ||
       parsedUrl.hostname.endsWith('.githubusercontent.com'))
    )
  } catch {
    return false
  }
}

// Fallback avatar component with user initials
const FallbackAvatar = ({ user }: { user: User }) => {
  const getInitials = () => {
    const name = user.user_metadata?.full_name || user.email || 'U'
    return name
      .split(' ')
      .map((part: string) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  return (
    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
      {getInitials()}
    </div>
  )
}

export default function AuthStatusBadge() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [avatarError, setAvatarError] = useState<string | null>(null)
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
        redirectTo: `${window.location.origin}/auth/callback`,
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
    const avatarUrl = user.user_metadata?.avatar_url
    const hasValidAvatar = avatarUrl && isValidAvatarUrl(avatarUrl) && !avatarError

    return (
      <div className="flex items-center gap-3">
        {hasValidAvatar ? (
          <Image
            src={avatarUrl}
            alt="Avatar"
            width={32}
            height={32}
            className="w-8 h-8 rounded-full"
            onError={() => {
              setAvatarError(avatarUrl)
            }}
            onLoad={() => {
              // Clear any previous error if image loads successfully
              if (avatarError === avatarUrl) {
                setAvatarError(null)
              }
            }}
          />
        ) : (
          <FallbackAvatar user={user} />
        )}
        <span className="text-sm text-gray-700">
          {user.user_metadata?.full_name || user.email}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors text-gray-800 font-medium border-gray-300"
        >
          Sign out
        </Button>
      </div>
    )
  }

  return (
    <Button 
      onClick={handleSignIn} 
      size="sm"
      variant="outline"
      className="text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors text-gray-800 font-medium border-gray-300"
    >
      Sign in with Google
    </Button>
  )
}