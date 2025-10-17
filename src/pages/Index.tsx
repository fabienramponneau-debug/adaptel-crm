import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AuthForm from '@/components/AuthForm';
import ChatInterface from '@/components/ChatInterface';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <AuthForm />;
  }

  return <ChatInterface userId={session.user.id} />;
}
